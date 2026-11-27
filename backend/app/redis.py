from redis.asyncio import Redis

from app.config import get_settings

_client: Redis | None = None


def set_redis(client: Redis | None) -> None:
    global _client
    _client = client


def get_redis() -> Redis:
    """FastAPI dependency (overridable in tests)."""
    global _client
    if _client is None:
        _client = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _client
