import logging
import uuid

from sqlalchemy import select

from owi_api.db import SessionLocal
from owi_api.models.enums import PredictionTask
from owi_api.models.prediction import MLModel

logger = logging.getLogger(__name__)


def run_inference(observation_id: str) -> None:
    """Run every active model over an observation, writing a prediction per task.

    No active models yet, so this is a no-op that logs — but the registry lookup
    and per-task loop are the real contract, ready for the first trained model.
    """
    with SessionLocal() as session:
        active = session.scalars(
            select(MLModel).where(MLModel.active.is_(True), MLModel.deleted_at.is_(None))
        ).all()
        if not active:
            logger.info("no active models — observation %s not scored", observation_id)
            return
        for model in active:
            _score(session, uuid.UUID(observation_id), model)
        session.commit()


def _score(session: object, observation_id: uuid.UUID, model: MLModel) -> None:
    # Placeholder until model artifacts load: real inference writes a Prediction row
    # (payload + confidence) tagged with model.id for full traceability.
    task: PredictionTask = model.task
    logger.info("would score observation %s with %s v%s", observation_id, task, model.version)
