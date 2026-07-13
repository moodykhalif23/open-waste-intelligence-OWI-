import httpx

from owi_api.analytics.routing import GeoPoint, HaversineMatrix


class OsrmMatrix:
    """Road distances from a self-hosted OSRM table service; the production upgrade
    over straight-line distances once an OSM extract is loaded."""

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    def distances(self, points: list[GeoPoint]) -> list[list[int]]:
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
