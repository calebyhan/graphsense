"""
Element lock manager — atomic locking via Redis SET NX.

Provides first-click-wins locking for canvas elements with 30s TTL auto-expiry.
"""

import logging
from typing import Optional

from redis.asyncio import Redis

logger = logging.getLogger(__name__)


class LockManager:
    LOCK_TTL = 30  # seconds

    def __init__(self, redis: Redis):
        self.redis = redis

    def _key(self, canvas_id: str, element_id: str) -> str:
        return f"canvas:{canvas_id}:lock:{element_id}"

    async def acquire(self, canvas_id: str, element_id: str, user_id: str) -> bool:
        """Attempt to acquire lock. Returns True if granted."""
        result = await self.redis.set(
            self._key(canvas_id, element_id),
            user_id,
            nx=True,
            ex=self.LOCK_TTL,
        )
        return result is not None

    async def renew(self, canvas_id: str, element_id: str, user_id: str) -> bool:
        """Renew lock TTL if held by user."""
        current = await self.redis.get(self._key(canvas_id, element_id))
        if current and current.decode() == user_id:
            await self.redis.expire(self._key(canvas_id, element_id), self.LOCK_TTL)
            return True
        return False

    async def release(self, canvas_id: str, element_id: str, user_id: str) -> bool:
        """Release lock only if held by user (atomic via Lua)."""
        key = self._key(canvas_id, element_id)
        lua = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        result = await self.redis.eval(lua, 1, key, user_id)
        return result == 1

    async def get_holder(self, canvas_id: str, element_id: str) -> Optional[str]:
        """Return user_id of lock holder, or None."""
        val = await self.redis.get(self._key(canvas_id, element_id))
        return val.decode() if val else None

    async def release_all_for_user(self, canvas_id: str, user_id: str) -> list[str]:
        """Release all locks held by user in canvas. Returns released element_ids."""
        pattern = f"canvas:{canvas_id}:lock:*"
        released = []
        async for key in self.redis.scan_iter(pattern):
            holder = await self.redis.get(key)
            if holder and holder.decode() == user_id:
                await self.redis.delete(key)
                element_id = key.decode().split(":")[-1]
                released.append(element_id)
        return released

    async def get_all_locks(self, canvas_id: str) -> dict[str, str]:
        """Return all active locks for a canvas: {element_id: user_id}."""
        pattern = f"canvas:{canvas_id}:lock:*"
        locks = {}
        async for key in self.redis.scan_iter(pattern):
            holder = await self.redis.get(key)
            if holder:
                element_id = key.decode().split(":")[-1]
                locks[element_id] = holder.decode()
        return locks
