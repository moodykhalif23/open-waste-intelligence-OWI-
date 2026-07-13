import logging
import uuid
from functools import lru_cache

import onnxruntime
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from owi_api.config import settings
from owi_api.db import SessionLocal
from owi_api.ingestion.storage import get_store
from owi_api.ml_infer import preprocess, top_prediction
from owi_api.models.enums import ReviewStatus
from owi_api.models.observation import Observation
from owi_api.models.prediction import MLModel, Prediction

logger = logging.getLogger(__name__)


@lru_cache(maxsize=8)
def _session_for(artifact_ref: str) -> onnxruntime.InferenceSession:
    # Cache by artifact key: loading a session costs ~100ms and the artifact is immutable.
    data = get_store(settings).get(artifact_ref)
    return onnxruntime.InferenceSession(data, providers=["CPUExecutionProvider"])


def run_inference(observation_id: str) -> None:
    """Score an observation with every active model, writing one Prediction per model."""
    with SessionLocal() as session:
        obs = session.get(Observation, uuid.UUID(observation_id))
        if obs is None:
            return
        models = session.scalars(
            select(MLModel).where(
                MLModel.org_id == obs.org_id,
                MLModel.active.is_(True),
                MLModel.deleted_at.is_(None),
                MLModel.artifact_ref.is_not(None),
            )
        ).all()
        if not models:
            logger.info("no active models — observation %s not scored", observation_id)
            return

        store = get_store(settings)
        image_bytes = store.get(obs.image_ref)
        for model in models:
            _score(session, obs, model, image_bytes)
        session.commit()


def _score(session: Session, obs: Observation, model: MLModel, image_bytes: bytes) -> None:
    already = session.scalar(
        select(exists().where(Prediction.observation_id == obs.id, Prediction.model_id == model.id))
    )
    if already or not model.labels or model.artifact_ref is None:
        return

    session_onnx = _session_for(model.artifact_ref)
    input_name = session_onnx.get_inputs()[0].name
    logits = session_onnx.run(None, {input_name: preprocess(image_bytes)})[0]
    label, confidence, scores = top_prediction(logits, model.labels)

    key = "fill_band" if model.task.value == "fill" else "material"
    session.add(
        Prediction(
            org_id=obs.org_id,
            observation_id=obs.id,
            model_id=model.id,
            task=model.task,
            payload={key: label, "confidence": confidence, "scores": scores},
            review_status=ReviewStatus.UNREVIEWED,
        )
    )
    logger.info("scored observation %s with %s: %s (%.2f)", obs.id, model.task, label, confidence)
