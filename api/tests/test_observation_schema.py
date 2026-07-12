import pytest
from pydantic import ValidationError

from owi_api.schemas.observation import ObservationIn

NOW = "2026-07-12T10:00:00Z"


def test_gps_only_is_valid() -> None:
    ObservationIn(captured_at=NOW, lat=-1.29, lng=36.82)


def test_bin_qr_without_gps_is_valid() -> None:
    ObservationIn(captured_at=NOW, bin_qr="abc123")


def test_no_location_reference_rejected() -> None:
    with pytest.raises(ValidationError, match="GPS coordinates or a bin reference"):
        ObservationIn(captured_at=NOW)


def test_partial_gps_without_bin_rejected() -> None:
    with pytest.raises(ValidationError):
        ObservationIn(captured_at=NOW, lat=-1.29)
