from dataclasses import dataclass


@dataclass(frozen=True)
class MaterialValue:
    material: str
    kg: float
    kes_per_kg: float | None
    value_kes: float


@dataclass(frozen=True)
class ValueReport:
    total_kg: float
    total_value_kes: float
    materials: list[MaterialValue]


def value_report(
    total_kg: float,
    shares_pct: dict[str, float],
    prices: dict[str, float],
) -> ValueReport:
    """Recoverable value: split collected tonnage by composition share, price each material.

    Two estimates chained (tonnage and composition), so callers present ranges, not points.
    """
    rows: list[MaterialValue] = []
    total_value = 0.0
    for material, share in sorted(shares_pct.items(), key=lambda kv: -kv[1]):
        kg = round(total_kg * share / 100, 1)
        price = prices.get(material)
        value = round(kg * price, 2) if price is not None else 0.0
        total_value += value
        rows.append(MaterialValue(material, kg, price, value))
    return ValueReport(round(total_kg, 1), round(total_value, 2), rows)


def match_partners(
    material: str,
    kg_per_month: float,
    partners: list[tuple[str, list[str], float]],
) -> list[str]:
    """Partners that accept the material and whose monthly minimum the supply meets."""
    return [
        name
        for name, accepted, min_kg in partners
        if material in accepted and kg_per_month >= min_kg
    ]
