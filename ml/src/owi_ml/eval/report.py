"""Evaluate the exported ONNX classifier and write a Markdown report.

Run from ``ml/`` with the API source and interpreter available:

    PYTHONPATH=src:../api/src ../api/.venv/bin/python -m owi_ml.eval.report
"""

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

from owi_ml.data.coco import CocoDataset, LabeledImage
from owi_ml.data.split import split_dataset
from owi_ml.eval.metrics import EvalReport, evaluate


def _gather(data_dir: Path) -> list[tuple[Path, str]]:
    return [
        (image, class_dir.name)
        for class_dir in sorted(path for path in data_dir.iterdir() if path.is_dir())
        for image in class_dir.glob("*.jpg")
    ]


def _report_text(
    *,
    model_path: Path,
    labels: list[str],
    dataset_dir: Path,
    sources: dict[str, str],
    examples: list[tuple[str, str, str, float]],
    truth: list[str],
    predicted: list[str],
    report: EvalReport,
) -> str:
    labels = ["other_mixed", *[label for label in labels if label != "other_mixed"]]
    matrix = Counter(zip(truth, predicted, strict=True))
    scores = {score.label: score for score in report.per_class}
    model_hash = hashlib.sha256(model_path.read_bytes()).hexdigest()
    source_text = ", ".join(f"{name} ({license})" for name, license in sorted(sources.items()))

    lines = [
        "# Material classifier evaluation",
        "",
        f"- **Model:** `{model_path}`",
        f"- **SHA-256:** `{model_hash}`",
        "- **Runtime:** ONNX Runtime CPU; OWI API image preprocessing "
        "(224 x 224 RGB, ImageNet normalization)",
        f"- **Evaluation data:** frozen 15% golden split from `{dataset_dir}` ({report.n} images)",
        "- **Split:** same filename-hash split used by training; "
        "these images are excluded from training",
        f"- **Sources:** {source_text}",
        "- **Scope note:** licensed public-dataset photos, not OWI field/pilot data; "
        "results may not represent local waste streams.",
        "",
        "## Overall results",
        "",
        "| Images | Accuracy | Macro-F1 | Release gate (macro-F1 ≥ 0.80) |",
        "|---:|---:|---:|:---:|",
        f"| {report.n} | {report.accuracy:.4f} | {report.macro_f1:.4f} | "
        f"{'PASS' if report.meets_gate() else 'FAIL'} |",
        "",
        "## Priority: `other_mixed`",
        "",
    ]

    mixed = scores.get("other_mixed")
    if mixed is None:
        lines.append("No `other_mixed` examples were present in the golden split.")
    else:
        mixed_misses = Counter(
            pred
            for actual, pred in zip(truth, predicted, strict=True)
            if actual == "other_mixed" and pred != actual
        )
        false_positives = Counter(
            actual
            for actual, pred in zip(truth, predicted, strict=True)
            if pred == "other_mixed" and actual != pred
        )
        lines.extend(
            [
                f"- Precision **{mixed.precision:.4f}**, recall **{mixed.recall:.4f}**, "
                f"F1 **{mixed.f1:.4f}** (support: {mixed.support}).",
                "- Missed `other_mixed` cases (recall): "
                + (
                    ", ".join(
                        f"`{label}` ({count})" for label, count in mixed_misses.most_common(5)
                    )
                    if mixed_misses
                    else "none."
                ),
                "- False positives (precision): "
                + (
                    ", ".join(
                        f"`{label}` ({count})" for label, count in false_positives.most_common(5)
                    )
                    if false_positives
                    else "none."
                ),
            ]
        )

    lines.extend(
        [
            "",
            "## Per-class metrics",
            "",
            "| Actual class | Precision | Recall | F1 | Support |",
            "|---|---:|---:|---:|---:|",
        ]
    )
    for label in labels:
        class_score = scores.get(label)
        if class_score:
            lines.append(
                f"| `{label}` | {class_score.precision:.4f} | {class_score.recall:.4f} | "
                f"{class_score.f1:.4f} | {class_score.support} |"
            )

    lines.extend(
        [
            "",
            "## Confusion matrix",
            "",
            "Rows are actual labels; columns are ONNX predictions. "
            "Class order prioritizes `other_mixed`.",
            "",
            "| Actual ↓ / Predicted → | " + " | ".join(f"`{label}`" for label in labels) + " |",
            "|---|" + "---:|" * len(labels),
        ]
    )
    for actual in labels:
        counts = [matrix[(actual, predicted_label)] for predicted_label in labels]
        lines.append(f"| `{actual}` | " + " | ".join(str(count) for count in counts) + " |")

    lines.extend(
        [
            "",
            "## Representative image checks",
            "",
            "ONNX predictions below are run on held-out public waste photos. "
            "`other_mixed` is listed first; samples include recall errors, precision errors, and "
            "correct cases.",
            "",
            "| Actual | Predicted | Confidence | Result | Image |",
            "|---|---|---:|---|---|",
        ]
    )
    for file_name, actual, predicted_label, confidence_score in examples:
        relative_image = Path("..") / dataset_dir / actual / Path(file_name).name
        outcome = "correct" if actual == predicted_label else "review"
        lines.append(
            f"| `{actual}` | `{predicted_label}` | {confidence_score:.4f} | {outcome} | "
            f"[{Path(file_name).name}]({relative_image.as_posix()}) |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the exported ONNX waste classifier")
    parser.add_argument("--data", type=Path, default=Path("datasets/merged"))
    parser.add_argument("--model", type=Path, default=Path("artifacts/classifier.onnx"))
    parser.add_argument("--labels", type=Path, default=Path("artifacts/labels.json"))
    parser.add_argument("--sources", type=Path, default=Path("datasets/merged/SOURCES.json"))
    parser.add_argument("--out", type=Path, default=Path("reports/classifier-evaluation.md"))
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--other-mixed-examples", type=int, default=12)
    args = parser.parse_args()
    if args.batch_size < 1 or args.other_mixed_examples < 0:
        parser.error("--batch-size must be positive and --other-mixed-examples non-negative")
    for path in (args.data, args.model, args.labels, args.sources):
        if not path.exists():
            raise SystemExit(f"required evaluation input does not exist: {path}")

    import numpy as np  # type: ignore[import-not-found]
    import onnxruntime  # type: ignore[import-not-found]
    from owi_api.ml_infer import preprocess  # type: ignore[import-not-found]

    samples = _gather(args.data)
    if not samples:
        raise SystemExit(f"no .jpg images found under {args.data}")
    labels = json.loads(args.labels.read_text())
    if not isinstance(labels, list) or not all(isinstance(label, str) for label in labels):
        raise SystemExit(f"invalid class labels in {args.labels}")
    class_names = {label for _, label in samples}
    if class_names != set(labels):
        raise SystemExit(
            f"dataset classes {sorted(class_names)} do not match model labels {labels}"
        )

    dataset = CocoDataset([LabeledImage(str(path), [label]) for path, label in samples])
    golden = split_dataset(dataset).golden
    path_labels = {str(path): (path, label) for path, label in samples}

    session_options = onnxruntime.SessionOptions()
    session_options.intra_op_num_threads = 4
    session = onnxruntime.InferenceSession(
        str(args.model),
        sess_options=session_options,
        providers=["CPUExecutionProvider"],
    )
    input_name = session.get_inputs()[0].name

    truth: list[str] = []
    predicted: list[str] = []
    confidence: list[float] = []
    for start in range(0, len(golden), args.batch_size):
        batch = golden[start : start + args.batch_size]
        tensors = [preprocess(path_labels[item.file_name][0].read_bytes()) for item in batch]
        images = np.concatenate(tensors, axis=0)
        logits = np.asarray(session.run(None, {input_name: images})[0])
        indices = logits.argmax(axis=1)
        shifted = logits - logits.max(axis=1, keepdims=True)
        probabilities = np.exp(shifted)
        probabilities /= probabilities.sum(axis=1, keepdims=True)
        for item, index, probs in zip(batch, indices, probabilities, strict=True):
            _, actual = path_labels[item.file_name]
            truth.append(actual)
            predicted.append(labels[int(index)])
            confidence.append(float(probs[int(index)]))
        done = min(start + len(batch), len(golden))
        if done == len(golden) or done % 512 < args.batch_size:
            print(f"evaluated {done}/{len(golden)} golden images", flush=True)

    report = evaluate(truth, predicted)
    rows = list(zip((item.file_name for item in golden), truth, predicted, confidence, strict=True))
    mixed_rows = [row for row in rows if row[1] == "other_mixed"]
    mixed_errors = [row for row in mixed_rows if row[1] != row[2]]
    mixed_correct = [row for row in mixed_rows if row[1] == row[2]]
    mixed_false_positives = [row for row in rows if row[2] == "other_mixed" and row[1] != row[2]]
    false_positive_labels = Counter(row[1] for row in mixed_false_positives)
    ranked_false_positives = []
    for label, _ in false_positive_labels.most_common():
        ranked_false_positives.extend([row for row in mixed_false_positives if row[1] == label][:2])
    mixed_limit = args.other_mixed_examples
    per_group_limit = mixed_limit // 3
    selected = (
        mixed_errors[:per_group_limit]
        + ranked_false_positives[:per_group_limit]
        + mixed_correct[:per_group_limit]
    )
    if len(selected) < mixed_limit:
        remaining = [*mixed_errors, *ranked_false_positives, *mixed_correct]
        selected.extend(row for row in remaining if row not in selected)
        selected = selected[:mixed_limit]
    for label in labels:
        if label == "other_mixed":
            continue
        candidates = [row for row in rows if row[1] == label]
        errors = [row for row in candidates if row[1] != row[2]]
        if candidates:
            selected.append((errors or candidates)[0])

    source_manifest = json.loads(args.sources.read_text())
    if not isinstance(source_manifest, dict):
        raise SystemExit(f"invalid source manifest in {args.sources}")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        _report_text(
            model_path=args.model,
            labels=labels,
            dataset_dir=args.data,
            sources=source_manifest,
            examples=selected,
            truth=truth,
            predicted=predicted,
            report=report,
        )
    )
    print(
        f"ONNX golden results: accuracy={report.accuracy:.4f} "
        f"macro-F1={report.macro_f1:.4f} n={report.n}"
    )
    for score in report.per_class:
        print(
            f"  {score.label:12} precision={score.precision:.4f} "
            f"recall={score.recall:.4f} f1={score.f1:.4f} support={score.support}"
        )
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
