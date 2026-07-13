import enum

from sqlalchemy import Enum


def db_enum(enum_cls: type[enum.StrEnum], name: str) -> Enum:
    """Store enum values (\"admin\"), not member names (\"ADMIN\") — must match the DB types."""
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


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


class OverflowRisk(enum.StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class PredictionTask(enum.StrEnum):
    DETECT = "detect"
    CLASSIFY = "classify"
    FILL = "fill"
    DUMPING = "dumping"


class ReviewStatus(enum.StrEnum):
    UNREVIEWED = "unreviewed"
    CONFIRMED = "confirmed"
    CORRECTED = "corrected"


class EventType(enum.StrEnum):
    CLEANUP = "cleanup"
    EDUCATION = "education"
    SORTING = "sorting"


class RouteStatus(enum.StrEnum):
    PLANNED = "planned"
    ACTIVE = "active"
    DONE = "done"
