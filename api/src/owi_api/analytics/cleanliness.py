from dataclasses import dataclass

METHOD_VERSION = "cleanliness-v1"
WEIGHTS = {
    "litter": 0.35,
    "overflow": 0.30,
    "dumping": 0.20,
    "reliability": 0.15,
}
# Below this many observations in the window, an area shows "insufficient data", not a score.
MIN_OBSERVATIONS = 10


@dataclass(frozen=True)
class Component:
    name: str
    value: float  # 0-100, higher = cleaner
    weight: float


@dataclass(frozen=True)
class CleanlinessResult:
    score: float | None
    components: list[Component]
    sufficient: bool
    method_version: str


def cleanliness_index(values: dict[str, float], observations: int) -> CleanlinessResult:
    """Weighted 0-100 area score, renormalized over available components (docs/05 formula)."""
    components = [
        Component(name, round(value, 1), WEIGHTS[name])
        for name, value in values.items()
        if name in WEIGHTS
    ]
    total_weight = sum(c.weight for c in components)
    sufficient = observations >= MIN_OBSERVATIONS and total_weight > 0
    score = (
        round(sum(c.value * c.weight for c in components) / total_weight, 1) if sufficient else None
    )
    return CleanlinessResult(score, components, sufficient, METHOD_VERSION)
