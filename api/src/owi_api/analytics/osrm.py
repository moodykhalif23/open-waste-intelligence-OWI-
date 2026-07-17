import logging

import httpx

from owi_api.analytics.routing import GeoPoint, HaversineMatrix

logger = logging.getLogger(__name__)


class OsrmMatrix:
    """Road distances from a self-hosted OSRM table service — the default in the
    containerized stack. Falls back to straight-line distances when OSRM is
    unreachable (e.g. still preparing its extract on first boot): a degraded
    plan beats a failed one."""

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    def distances(self, points: list[GeoPoint]) -> list[list[int]]:
        try:
            return self._road_distances(points)
        except (httpx.HTTPError, RuntimeError, KeyError, ValueError, TypeError) as exc:
            logger.warning("OSRM unavailable (%s) — using straight-line distances", exc)
            return HaversineMatrix().distances(points)

    def _road_distances(self, points: list[GeoPoint]) -> list[list[int]]:
        coords = ";".join(f"{lng},{lat}" for lng, lat in points)
        url = f"{self._base_url}/table/v1/driving/{coords}"
        response = httpx.get(url, params={"annotations": "distance"}, timeout=30)
        response.raise_for_status()
        data = response.json()
        if data.get("code") != "Ok":
            raise RuntimeError(f"OSRM error: {data.get('code')}")
        return [[round(d) for d in row] for row in data["distances"]]


def get_distance_matrix(osrm_url: str | None) -> OsrmMatrix | HaversineMatrix:
    return OsrmMatrix(osrm_url) if osrm_url else HaversineMatrix()
