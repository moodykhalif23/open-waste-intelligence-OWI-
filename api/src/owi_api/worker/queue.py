import uuid

from redis import Redis
from rq import Queue

from owi_api.config import settings


def get_queue() -> Queue:
    return Queue("inference", connection=Redis.from_url(settings.redis_url))


def enqueue_inference(observation_id: uuid.UUID) -> None:
    get_queue().enqueue("owi_api.worker.jobs.run_inference", str(observation_id))
