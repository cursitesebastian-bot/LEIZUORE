"""Fixed-window rate limiting on Redis."""

from collections.abc import Callable

from fastapi import Depends, Request
from redis.asyncio import Redis

from app.errors import AppError
from app.redis import get_redis


async def hit(redis: Redis, key: str, limit: int, window: int) -> None:
    """Count one hit; raise 429 when over the limit."""
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, window)
    if count > limit:
        ttl = await redis.ttl(key)
        retry = max(ttl, 1)
        raise AppError(
            429,
            "rate_limited",
            f"Too many tries. Please wait {max(1, retry // 60)} min and try again.",
            headers={"Retry-After": str(retry)},
        )


def client_ip(request: Request) -> str:
    # Run uvicorn with --proxy-headers behind a trusted proxy so this is the real client.
    return request.client.host if request.client else "unknown"


def rate_limit(name: str, limit: int, window: int) -> Callable:
    """Per-IP limiter used as a route dependency."""

    async def dependency(request: Request, redis: Redis = Depends(get_redis)) -> None:
        await hit(redis, f"rl:{name}:{client_ip(request)}", limit, window)

    return dependency
