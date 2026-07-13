from dataclasses import dataclass

KG_PER_TONNE = 1000


@dataclass(frozen=True)
class Scenario:
    km: float
    kg: float
    fuel_l: float


@dataclass(frozen=True)
class SavingsReport:
    baseline: Scenario
    optimized: Scenario
    baseline_km_per_tonne: float | None
    optimized_km_per_tonne: float | None
    km_per_tonne_reduction_pct: float | None
    fuel_l_saved: float
    kes_saved: float | None


def _km_per_tonne(scenario: Scenario) -> float | None:
    tonnes = scenario.kg / KG_PER_TONNE
    return round(scenario.km / tonnes, 2) if tonnes > 0 else None


def compute_savings(
    baseline: Scenario,
    optimized: Scenario,
    fuel_price_kes_per_l: float = 0.0,
) -> SavingsReport:
    """Need-driven vs fixed-schedule efficiency; km/tonne is the honest normalizer."""
    base_kpt = _km_per_tonne(baseline)
    opt_kpt = _km_per_tonne(optimized)
    reduction = (
        round((base_kpt - opt_kpt) / base_kpt * 100, 1)
        if base_kpt and opt_kpt and base_kpt > 0
        else None
    )
    fuel_saved = round(baseline.fuel_l - optimized.fuel_l, 2)
    kes = round(fuel_saved * fuel_price_kes_per_l, 2) if fuel_price_kes_per_l > 0 else None
    return SavingsReport(
        baseline=baseline,
        optimized=optimized,
        baseline_km_per_tonne=base_kpt,
        optimized_km_per_tonne=opt_kpt,
        km_per_tonne_reduction_pct=reduction,
        fuel_l_saved=fuel_saved,
        kes_saved=kes,
    )
