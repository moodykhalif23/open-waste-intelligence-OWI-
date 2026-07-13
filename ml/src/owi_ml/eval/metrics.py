from dataclasses import dataclass


@dataclass(frozen=True)
class ClassScore:
    label: str
    precision: float
    recall: float
    f1: float
    support: int


@dataclass(frozen=True)
class EvalReport:
    per_class: list[ClassScore]
    macro_f1: float
    accuracy: float
    n: int

    def meets_gate(self, threshold: float = 0.80) -> bool:
        return self.macro_f1 >= threshold


def _f1(precision: float, recall: float) -> float:
    return 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0


def evaluate(y_true: list[str], y_pred: list[str]) -> EvalReport:
    """Per-class precision/recall/F1 + macro-F1 — the frozen-golden-set go/no-go gate."""
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred length mismatch")
    if not y_true:
        return EvalReport(per_class=[], macro_f1=0.0, accuracy=0.0, n=0)

    labels = sorted(set(y_true) | set(y_pred))
    correct = sum(t == p for t, p in zip(y_true, y_pred, strict=True))
    scores: list[ClassScore] = []
    for label in labels:
        tp = sum(t == label and p == label for t, p in zip(y_true, y_pred, strict=True))
        fp = sum(t != label and p == label for t, p in zip(y_true, y_pred, strict=True))
        fn = sum(t == label and p != label for t, p in zip(y_true, y_pred, strict=True))
        support = sum(t == label for t in y_true)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        scores.append(
            ClassScore(
                label,
                round(precision, 4),
                round(recall, 4),
                round(_f1(precision, recall), 4),
                support,
            )
        )

    # Macro-F1 averages over classes that actually occur in the ground truth, so
    # spurious predicted-only labels can't dilute the score.
    present = [s for s in scores if s.support > 0]
    macro_f1 = round(sum(s.f1 for s in present) / len(present), 4) if present else 0.0
    return EvalReport(scores, macro_f1, round(correct / len(y_true), 4), len(y_true))
