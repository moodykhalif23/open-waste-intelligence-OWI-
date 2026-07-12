import enum


class UserRole(enum.StrEnum):
    ADMIN = "admin"
    COORDINATOR = "coordinator"
    COLLECTOR = "collector"
    VIEWER = "viewer"
    API_CONSUMER = "api_consumer"


class FillBand(enum.StrEnum):
    EMPTY = "empty"
    LOW = "low"
    HALF = "half"
    HIGH = "high"
    OVERFLOWING = "overflowing"


class LocationSource(enum.StrEnum):
    GPS = "gps"
    BIN_REGISTRY = "bin_registry"


class PrivacyStatus(enum.StrEnum):
    CLEAN = "clean"
    BLURRED = "blurred"
    QUARANTINED = "quarantined"
