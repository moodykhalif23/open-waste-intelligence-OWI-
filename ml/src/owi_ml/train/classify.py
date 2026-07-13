"""Train the T2 material classifier on public + local waste images.

    python -m owi_ml.train.classify --data datasets/trashnet --epochs 3

Fine-tunes a small ImageNet backbone, evaluates on the frozen golden split with the
same macro-F1 gate used for release decisions, and exports ONNX for the batch worker.
Pretrain here on public data; re-run with the local Safi export folded in to fine-tune.
"""

import argparse
import json
from pathlib import Path

from owi_ml.data.coco import CocoDataset, LabeledImage
from owi_ml.data.split import split_dataset
from owi_ml.eval.metrics import evaluate


def _gather(data_dir: Path) -> list[tuple[Path, str]]:
    samples = []
    for class_dir in sorted(p for p in data_dir.iterdir() if p.is_dir()):
        for img in class_dir.glob("*.jpg"):
            samples.append((img, class_dir.name))
    return samples


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the T2 material classifier")
    parser.add_argument("--data", type=Path, required=True, help="folder of <class>/*.jpg")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--out", type=Path, default=Path("artifacts"))
    args = parser.parse_args()

    import torch
    from PIL import Image
    from torch import nn
    from torch.utils.data import DataLoader, Dataset
    from torchvision import models, transforms
    from torchvision.models import MobileNet_V3_Small_Weights

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

    try:
        weights = MobileNet_V3_Small_Weights.IMAGENET1K_V1
        model = models.mobilenet_v3_small(weights=weights)
    except Exception as exc:
        print(f"pretrained weights unavailable ({exc}); training from scratch")
        model = models.mobilenet_v3_small(weights=None)
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, len(labels))

    device = torch.device("cpu")
    model.to(device)
    loader = DataLoader(ImgSet(split.train), batch_size=args.batch, shuffle=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.CrossEntropyLoss()

    for epoch in range(args.epochs):
        model.train()
        running = 0.0
        for images, targets in loader:
            optimizer.zero_grad()
            loss = loss_fn(model(images.to(device)), targets.to(device))
            loss.backward()
            optimizer.step()
            running += loss.item()
        print(f"epoch {epoch + 1}/{args.epochs}  loss={running / len(loader):.3f}")

    model.eval()
    y_true, y_pred = [], []
    with torch.no_grad():
        for img_meta in split.golden:
            path, label = by_name[img_meta.file_name]
            logits = model(tf(Image.open(path).convert("RGB")).unsqueeze(0).to(device))
            y_true.append(label)
            y_pred.append(labels[int(logits.argmax(1).item())])
    report = evaluate(y_true, y_pred)
    print(f"golden macro-F1={report.macro_f1} accuracy={report.accuracy} (n={report.n})")

    args.out.mkdir(parents=True, exist_ok=True)
    dummy = torch.randn(1, 3, 224, 224)
    torch.onnx.export(
        model,
        (dummy,),
        str(args.out / "classifier.onnx"),
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )
    (args.out / "labels.json").write_text(json.dumps(labels))
    (args.out / "metrics.json").write_text(
        json.dumps({"macro_f1": report.macro_f1, "accuracy": report.accuracy, "n": report.n})
    )
    print(f"exported {args.out / 'classifier.onnx'} + labels.json + metrics.json")
    print(f"gate (macro-F1 >= 0.80): {'PASS' if report.meets_gate() else 'below threshold'}")


if __name__ == "__main__":
    main()
