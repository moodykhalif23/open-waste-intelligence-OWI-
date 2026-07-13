from owi_ml.eval.metrics import evaluate


def test_perfect_prediction_scores_one() -> None:
    y = ["plastic", "glass", "plastic", "organic"]
    report = evaluate(y, y)
    assert report.macro_f1 == 1.0
    assert report.accuracy == 1.0
    assert report.meets_gate()


def test_empty_is_zero() -> None:
    report = evaluate([], [])
    assert report.macro_f1 == 0.0 and report.n == 0


def test_length_mismatch_rejected() -> None:
    try:
        evaluate(["a"], ["a", "b"])
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_per_class_precision_recall() -> None:
    # plastic: 2 true; predicts plastic 3 times (1 wrong) -> P=2/3, R=2/2=1.
    y_true = ["plastic", "plastic", "glass"]
    y_pred = ["plastic", "plastic", "plastic"]
    report = evaluate(y_true, y_pred)
    plastic = next(s for s in report.per_class if s.label == "plastic")
    assert plastic.precision == round(2 / 3, 4)
    assert plastic.recall == 1.0
    glass = next(s for s in report.per_class if s.label == "glass")
    assert glass.recall == 0.0  # the one glass was misread as plastic


def test_gate_threshold() -> None:
    # class a: P=2/3 R=1 → F1=0.8; class b: F1=0 → macro-F1 = 0.4, below 0.80.
    report = evaluate(["a", "a", "b"], ["a", "a", "a"])
    assert not report.meets_gate()
    assert report.macro_f1 == 0.4


def test_macro_ignores_predicted_only_labels() -> None:
    # "metal" never appears in truth; it must not create a zero-support class that drags macro-F1.
    report = evaluate(["plastic", "plastic"], ["plastic", "metal"])
    labels = {s.label for s in report.per_class if s.support > 0}
    assert labels == {"plastic"}
