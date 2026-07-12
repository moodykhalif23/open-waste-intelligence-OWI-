import uuid

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow
from owi_api.models.enums import PredictionTask, ReviewStatus, db_enum


class MLModel(OwiRow, Base):
    """Registry row: what produced a prediction, so every result is traceable."""

    __tablename__ = "ml_models"
    __table_args__ = (UniqueConstraint("org_id", "task", "version", name="uq_model_version"),)

    task: Mapped[PredictionTask] = mapped_column(db_enum(PredictionTask, "prediction_task"))
    version: Mapped[str] = mapped_column(String(50))
    git_commit: Mapped[str | None] = mapped_column(String(40))
    dataset_hash: Mapped[str | None] = mapped_column(String(64))
    metrics: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=False)


class Prediction(OwiRow, Base):
    __tablename__ = "predictions"

    observation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("observations.id")
    )
    model_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ml_models.id"))
    task: Mapped[PredictionTask] = mapped_column(db_enum(PredictionTask, "prediction_task"))
    payload: Mapped[dict[str, object]] = mapped_column(JSONB)
    review_status: Mapped[ReviewStatus] = mapped_column(
        db_enum(ReviewStatus, "review_status"), default=ReviewStatus.UNREVIEWED
    )
    corrected_payload: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
