"""Train the T2 material classifier on public + local waste images.

    python -m owi_ml.train.classify --data datasets/merged

Default backbone is DINOv2 ViT-S (Apache-2.0, timm) frozen, with a linear head trained
on extracted features — strong accuracy with no GPU required, because the expensive
backbone pass happens exactly once per image. `--backbone mobilenet` keeps the earlier
end-to-end fine-tune. Both evaluate on the frozen golden split with the macro-F1 gate
and export ONNX matching the batch worker's 224² ImageNet-normalized contract.
"""

import argparse
import json
from pathlib import Path

from owi_ml.data.coco import CocoDataset, LabeledImage
from owi_ml.data.split import split_dataset
from owi_ml.eval.metrics import EvalReport, evaluate

DINOV2 = "vit_small_patch14_dinov2.lvd142m"


def _gather(data_dirs: list[Path]) -> list[tuple[Path, str]]:
    samples = []
    for data_dir in data_dirs:
        for class_dir in sorted(p for p in data_dir.iterdir() if p.is_dir()):
            for img in class_dir.glob("*.jpg"):
                samples.append((img, class_dir.name))
    return samples


def _write_artifacts(
    out: Path, model: object, labels: list[str], report: EvalReport, backbone: str
) -> None:
    import torch

    out.mkdir(parents=True, exist_ok=True)
    dummy = torch.randn(1, 3, 224, 224)
    torch.onnx.export(
        model,  # type: ignore[arg-type]
        (dummy,),
        str(out / "classifier.onnx"),
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,  # legacy exporter: clean dynamic axes, no onnxscript/console-emoji issues
    )
    (out / "labels.json").write_text(json.dumps(labels))
    metrics: dict[str, float] = {
        "macro_f1": report.macro_f1,
        "accuracy": report.accuracy,
        "n": float(report.n),
    }
    for score in report.per_class:
        metrics[f"f1_{score.label}"] = score.f1
    (out / "metrics.json").write_text(json.dumps(metrics))
    (out / "training.json").write_text(json.dumps({"backbone": backbone}))
    print(f"exported {out / 'classifier.onnx'} + labels.json + metrics.json")
    print(f"gate (macro-F1 >= 0.80): {'PASS' if report.meets_gate() else 'below threshold'}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the T2 material classifier")
    parser.add_argument(
        "--data",
        type=Path,
        required=True,
        nargs="+",
        help="one or more folders of <class>/*.jpg (e.g. datasets/merged datasets/safi)",
    )
    parser.add_argument("--backbone", choices=["dinov2", "mobilenet"], default="dinov2")
    parser.add_argument("--epochs", type=int, default=0, help="0 = per-backbone default")
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--out", type=Path, default=Path("artifacts"))
    args = parser.parse_args()

    import torch
    from PIL import Image
    from torch import nn
    from torch.utils.data import DataLoader, Dataset
    from torchvision import transforms

    def readable(path: Path) -> bool:
        try:
            Image.open(path).convert("RGB")
            return True
        except Exception:  # public datasets ship the occasional corrupt file
            return False

    samples = _gather(args.data)
    dropped = [p for p, _ in samples if not readable(p)]
    samples = [(p, label) for p, label in samples if p not in set(dropped)]
    if dropped:
        print(f"skipped {len(dropped)} unreadable image(s)")
    if not samples:
        raise SystemExit(f"no images under {args.data} — run: python -m owi_ml.data.download")

    # Freeze the golden split by filename hash so evaluation never sees trained images.
    ds = CocoDataset([LabeledImage(str(p), [label]) for p, label in samples])
    split = split_dataset(ds)
    labels = sorted({label for _, label in samples})
    label_idx = {name: i for i, name in enumerate(labels)}
    by_name = {str(p): (p, label) for p, label in samples}
    print(f"corpus: {len(samples)} images, {len(labels)} classes")
    print(f"split: train={len(split.train)} val={len(split.val)} golden={len(split.golden)}")

    tf = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )

    class ImgSet(Dataset):  # type: ignore[type-arg]
        def __init__(self, images: list[LabeledImage]) -> None:
            self.items = [by_name[i.file_name] for i in images]

        def __len__(self) -> int:
            return len(self.items)

        def __getitem__(self, i: int) -> tuple[object, int]:
            path, label = self.items[i]
            return tf(Image.open(path).convert("RGB")), label_idx[label]

    device = torch.device("cpu")

    # Inverse-frequency class weights: GD v2's clothes-heavy textile class must not
    # drown organic/e_waste in the loss.
    train_counts = [0] * len(labels)
    for item in split.train:
        train_counts[label_idx[by_name[item.file_name][1]]] += 1
    weights = torch.tensor(
        [len(split.train) / (len(labels) * max(c, 1)) for c in train_counts],
        dtype=torch.float32,
    )

    if args.backbone == "dinov2":
        import timm

        epochs = args.epochs or 80
        backbone = timm.create_model(DINOV2, pretrained=True, num_classes=0, img_size=224)
        backbone.eval()
        for p in backbone.parameters():
            p.requires_grad_(False)

        @torch.no_grad()
        def extract(images: list[LabeledImage]) -> tuple[torch.Tensor, torch.Tensor]:
            loader = DataLoader(ImgSet(images), batch_size=args.batch, num_workers=0)
            feats, targets = [], []
            for done, (batch, target) in enumerate(loader):
                feats.append(backbone(batch))
                targets.append(target)
                if done % 20 == 0:
                    print(f"  features {done * args.batch}/{len(images)}", flush=True)
            return torch.cat(feats), torch.cat(targets)

        print("extracting frozen DINOv2 features (one-off, CPU) ...")
        x_train, y_train = extract(split.train)
        x_val, y_val = extract(split.val)

        head = nn.Linear(x_train.shape[1], len(labels))
        optimizer = torch.optim.AdamW(head.parameters(), lr=1e-3, weight_decay=1e-4)
        schedule = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        loss_fn = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.05)
        perm_batch = 512
        for epoch in range(epochs):
            head.train()
            order = torch.randperm(len(x_train))
            running = 0.0
            for start in range(0, len(order), perm_batch):
                idx = order[start : start + perm_batch]
                optimizer.zero_grad()
                loss = loss_fn(head(x_train[idx]), y_train[idx])
                loss.backward()
                optimizer.step()
                running += loss.item()
            schedule.step()
            if (epoch + 1) % 10 == 0:
                head.eval()
                with torch.no_grad():
                    val_acc = (head(x_val).argmax(1) == y_val).float().mean().item()
                print(f"epoch {epoch + 1}/{epochs}  loss={running:.3f}  val_acc={val_acc:.3f}")

        head.eval()

        class Wrapped(nn.Module):
            def __init__(self) -> None:
                super().__init__()
                self.backbone = backbone
                self.head = head

            def forward(self, x: torch.Tensor) -> torch.Tensor:
                out: torch.Tensor = self.head(self.backbone(x))
                return out

        model: nn.Module = Wrapped()

        print("evaluating on the frozen golden split ...")
        x_gold, y_gold = extract(split.golden)
        with torch.no_grad():
            pred_idx = head(x_gold).argmax(1)
        y_true = [labels[int(i)] for i in y_gold]
        y_pred = [labels[int(i)] for i in pred_idx]
    else:
        from torchvision import models
        from torchvision.models import MobileNet_V3_Small_Weights

        epochs = args.epochs or 3
        try:
            net = models.mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1)
        except Exception as exc:
            print(f"pretrained weights unavailable ({exc}); training from scratch")
            net = models.mobilenet_v3_small(weights=None)
        net.classifier[3] = nn.Linear(net.classifier[3].in_features, len(labels))
        net.to(device)
        loader = DataLoader(ImgSet(split.train), batch_size=args.batch, shuffle=True)
        optimizer = torch.optim.AdamW(net.parameters(), lr=1e-3)
        loss_fn = nn.CrossEntropyLoss(weight=weights)
        for epoch in range(epochs):
            net.train()
            running = 0.0
            for images, targets in loader:
                optimizer.zero_grad()
                loss = loss_fn(net(images.to(device)), targets.to(device))
                loss.backward()
                optimizer.step()
                running += loss.item()
            print(f"epoch {epoch + 1}/{epochs}  loss={running / len(loader):.3f}")
        net.eval()
        model = net
        y_true, y_pred = [], []
        with torch.no_grad():
            for img_meta in split.golden:
                path, label = by_name[img_meta.file_name]
                logits = net(tf(Image.open(path).convert("RGB")).unsqueeze(0).to(device))
                y_true.append(label)
                y_pred.append(labels[int(logits.argmax(1).item())])

    report = evaluate(y_true, y_pred)
    print(f"golden macro-F1={report.macro_f1} accuracy={report.accuracy} (n={report.n})")
    for score in report.per_class:
        print(f"  {score.label:12} f1={score.f1:.3f} (n={score.support})")
    _write_artifacts(args.out, model, labels, report, args.backbone)


if __name__ == "__main__":
    main()
