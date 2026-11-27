"""Background job dispatch.

Jobs are plain async functions in app/jobs.py, run by an ARQ worker
(`arq app.jobs.WorkerSettings`). In tests and when JOBS_INLINE=true they run
immediately in-process, so local development needs no worker.
"""

import os

import structlog
from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.config import get_settings

log = structlog.get_logger()
_pool: ArqRedis | None = None


def _inline() -> bool:
    return get_settings().environment == "test" or os.environ.get("JOBS_INLINE", "").lower() == "true"


async def enqueue(job: str, *args) -> None:
    if _inline():
        from app import jobs

        await getattr(jobs, job)({}, *args)
        return
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(get_settings().redis_url))
    await _pool.enqueue_job(job, *args)
