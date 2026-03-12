"""
WebSocket connection manager — room management + Redis pub/sub fanout.

Each backend instance tracks its own local WebSocket pool. Messages are
published to Redis for cross-instance delivery.
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import WebSocket
from redis.asyncio import Redis

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self, redis: Redis):
        self.redis = redis
        # canvas_id → {user_id: WebSocket}
        self._rooms: dict[str, dict[str, WebSocket]] = {}
        # canvas_id → subscriber task
        self._subscribers: dict[str, asyncio.Task] = {}

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket, canvas_id: str, user_id: str) -> None:
        if canvas_id not in self._rooms:
            self._rooms[canvas_id] = {}
        self._rooms[canvas_id][user_id] = websocket

        # Store presence in Redis hash
        await self.redis.hset(
            f"canvas:{canvas_id}:presence",
            user_id,
            json.dumps({"user_id": user_id}),
        )

        # Start Redis subscriber for this room if not already running (or if prior task died)
        existing = self._subscribers.get(canvas_id)
        if existing is None or existing.done():
            if existing is not None and existing.done():
                exc = existing.exception() if not existing.cancelled() else None
                if exc:
                    logger.warning(
                        "Redis subscriber for canvas %s died unexpectedly; restarting",
                        canvas_id,
                        exc_info=exc,
                    )
            self._subscribers[canvas_id] = asyncio.create_task(
                self._redis_subscriber(canvas_id)
            )

    async def disconnect(self, canvas_id: str, user_id: str) -> None:
        room = self._rooms.get(canvas_id)
        if room:
            room.pop(user_id, None)

        # Remove from presence hash
        await self.redis.hdel(f"canvas:{canvas_id}:presence", user_id)

        # Cleanup empty rooms
        if room is not None and not room:
            del self._rooms[canvas_id]
            await self._stop_subscriber(canvas_id)

    def get_room_users(self, canvas_id: str) -> list[str]:
        """Return user_ids currently connected to this room on THIS instance."""
        room = self._rooms.get(canvas_id, {})
        return list(room.keys())

    # ------------------------------------------------------------------
    # Messaging
    # ------------------------------------------------------------------

    async def broadcast(
        self, canvas_id: str, message: dict, exclude_user: Optional[str] = None
    ) -> None:
        """Publish message to Redis channel for cross-instance fanout."""
        payload = json.dumps({**message, "_exclude": exclude_user})
        await self.redis.publish(f"canvas:{canvas_id}", payload)

    async def send_to_user(
        self, canvas_id: str, user_id: str, message: dict
    ) -> None:
        """Send directly to a local WebSocket (no Redis needed)."""
        room = self._rooms.get(canvas_id, {})
        ws = room.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                logger.debug("Failed to send to user %s", user_id)

    async def _deliver_local(
        self, canvas_id: str, message: dict, exclude_user: Optional[str] = None
    ) -> None:
        """Fan out message to all local WebSockets in a room."""
        room = self._rooms.get(canvas_id, {})
        for uid, ws in list(room.items()):
            if uid == exclude_user:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                logger.debug("Failed to deliver to %s, removing", uid)
                room.pop(uid, None)

    # ------------------------------------------------------------------
    # Redis pub/sub listener
    # ------------------------------------------------------------------

    async def _redis_subscriber(self, canvas_id: str) -> None:
        """Background task: subscribe to Redis channel and fan out to local clients."""
        channel_name = f"canvas:{canvas_id}"
        pubsub = self.redis.pubsub()
        try:
            await pubsub.subscribe(channel_name)
            async for raw_message in pubsub.listen():
                if raw_message["type"] != "message":
                    continue
                try:
                    data = json.loads(raw_message["data"])
                    exclude = data.pop("_exclude", None)
                    await self._deliver_local(canvas_id, data, exclude_user=exclude)
                except Exception:
                    logger.exception("Error processing pub/sub message")
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()

    async def _stop_subscriber(self, canvas_id: str) -> None:
        task = self._subscribers.pop(canvas_id, None)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    # ------------------------------------------------------------------
    # Presence helpers
    # ------------------------------------------------------------------

    async def get_presence(self, canvas_id: str) -> list[dict]:
        """Return presence list from Redis hash."""
        raw = await self.redis.hgetall(f"canvas:{canvas_id}:presence")
        presence = []
        for _uid, val in raw.items():
            try:
                presence.append(json.loads(val))
            except Exception:
                pass
        return presence
