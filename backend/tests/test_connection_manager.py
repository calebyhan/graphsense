"""
Unit tests for ConnectionManager.
WebSocket objects and Redis are replaced with mocks.

Note: redis.pubsub() is a SYNCHRONOUS factory in redis-py AsyncRedis, so it must
be mocked as a plain MagicMock (not AsyncMock) — calling AsyncMock() returns a
coroutine, not a pubsub object, which breaks the subscriber.
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.connection_manager import ConnectionManager


def make_pubsub(messages=None):
    """
    Return a MagicMock pubsub whose listen() yields `messages` then raises
    CancelledError (so the subscriber loop exits cleanly when cancelled or
    when messages are exhausted).
    """
    pubsub = MagicMock()
    pubsub.subscribe = AsyncMock()
    pubsub.unsubscribe = AsyncMock()
    pubsub.close = AsyncMock()

    async def blocking_listen():
        """Blocks until cancelled — used by tests that don't need messages."""
        await asyncio.sleep(3600)
        return
        yield  # make it an async generator

    async def message_then_cancel_listen():
        for msg in (messages or []):
            yield msg
        # After all messages delivered, block until cancelled
        await asyncio.sleep(3600)

    if messages is not None:
        pubsub.listen = message_then_cancel_listen
    else:
        pubsub.listen = blocking_listen

    return pubsub


@pytest.fixture
def redis():
    r = AsyncMock()
    r.hset = AsyncMock()
    r.hdel = AsyncMock()
    r.hgetall = AsyncMock(return_value={})
    r.publish = AsyncMock()
    # pubsub() is synchronous in redis-py — use a plain MagicMock
    r.pubsub = MagicMock(return_value=make_pubsub())
    return r


@pytest.fixture
def mgr(redis):
    return ConnectionManager(redis)


def make_ws():
    # Don't use spec=WebSocket: WebSocket's base class defines __bool__ to return
    # False when there's no live connection, causing `if ws:` guards to skip sends.
    return AsyncMock()


async def stop_subscriber(mgr, canvas_id):
    """Cancel the background subscriber task and wait for it to finish."""
    task = mgr._subscribers.get(canvas_id)
    if task and not task.done():
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


# ---------------------------------------------------------------------------
# connect / disconnect
# ---------------------------------------------------------------------------

async def test_connect_registers_ws(mgr, redis):
    ws = make_ws()
    await mgr.connect(ws, "c1", "u1")
    await stop_subscriber(mgr, "c1")

    assert "c1" in mgr._rooms
    assert mgr._rooms["c1"]["u1"] is ws
    redis.hset.assert_awaited_once_with(
        "canvas:c1:presence", "u1", json.dumps({"user_id": "u1"})
    )


async def test_connect_starts_subscriber(mgr):
    ws = make_ws()
    await mgr.connect(ws, "c1", "u1")
    assert "c1" in mgr._subscribers
    assert not mgr._subscribers["c1"].done()
    await stop_subscriber(mgr, "c1")


async def test_connect_reuses_subscriber(mgr):
    ws1, ws2 = make_ws(), make_ws()
    await mgr.connect(ws1, "c1", "u1")
    task1 = mgr._subscribers["c1"]
    await mgr.connect(ws2, "c1", "u2")
    assert mgr._subscribers["c1"] is task1
    await stop_subscriber(mgr, "c1")


async def test_disconnect_removes_user(mgr, redis):
    ws = make_ws()
    await mgr.connect(ws, "c1", "u1")
    await stop_subscriber(mgr, "c1")

    await mgr.disconnect("c1", "u1")

    assert "u1" not in mgr._rooms.get("c1", {})
    redis.hdel.assert_awaited_with("canvas:c1:presence", "u1")


async def test_disconnect_removes_empty_room(mgr, redis):
    ws = make_ws()
    await mgr.connect(ws, "c1", "u1")
    await stop_subscriber(mgr, "c1")

    await mgr.disconnect("c1", "u1")

    assert "c1" not in mgr._rooms
    assert "c1" not in mgr._subscribers


async def test_disconnect_nonexistent_is_safe(mgr):
    await mgr.disconnect("no-canvas", "no-user")


# ---------------------------------------------------------------------------
# get_room_users
# ---------------------------------------------------------------------------

async def test_get_room_users(mgr):
    ws1, ws2 = make_ws(), make_ws()
    await mgr.connect(ws1, "c1", "u1")
    await mgr.connect(ws2, "c1", "u2")
    await stop_subscriber(mgr, "c1")

    users = mgr.get_room_users("c1")
    assert set(users) == {"u1", "u2"}


async def test_get_room_users_empty_room(mgr):
    assert mgr.get_room_users("no-room") == []


# ---------------------------------------------------------------------------
# broadcast
# ---------------------------------------------------------------------------

async def test_broadcast_publishes_to_redis(mgr, redis):
    await mgr.broadcast("c1", {"type": "test", "x": 1})
    redis.publish.assert_awaited_once()
    channel, payload = redis.publish.await_args.args
    assert channel == "canvas:c1"
    data = json.loads(payload)
    assert data["type"] == "test"
    assert data["x"] == 1
    assert data["_exclude"] is None


async def test_broadcast_with_exclude(mgr, redis):
    await mgr.broadcast("c1", {"type": "t"}, exclude_user="u1")
    _, payload = redis.publish.await_args.args
    data = json.loads(payload)
    assert data["_exclude"] == "u1"


# ---------------------------------------------------------------------------
# send_to_user
# ---------------------------------------------------------------------------

async def test_send_to_user_delivers(mgr):
    ws = make_ws()
    await mgr.connect(ws, "c1", "u1")
    await stop_subscriber(mgr, "c1")

    await mgr.send_to_user("c1", "u1", {"type": "ping"})
    ws.send_json.assert_awaited_once_with({"type": "ping"})


async def test_send_to_user_no_room(mgr):
    await mgr.send_to_user("no-canvas", "u1", {"type": "ping"})


async def test_send_to_user_no_user(mgr):
    ws = make_ws()
    await mgr.connect(ws, "c1", "u1")
    await stop_subscriber(mgr, "c1")

    await mgr.send_to_user("c1", "u99", {"type": "ping"})
    ws.send_json.assert_not_awaited()


# ---------------------------------------------------------------------------
# _deliver_local
# ---------------------------------------------------------------------------

async def test_deliver_local_skips_excluded(mgr):
    ws1, ws2 = make_ws(), make_ws()
    await mgr.connect(ws1, "c1", "u1")
    await mgr.connect(ws2, "c1", "u2")
    await stop_subscriber(mgr, "c1")

    await mgr._deliver_local("c1", {"type": "t"}, exclude_user="u1")

    ws1.send_json.assert_not_awaited()
    ws2.send_json.assert_awaited_once_with({"type": "t"})


async def test_deliver_local_removes_dead_socket(mgr):
    ws = make_ws()
    ws.send_json.side_effect = Exception("connection closed")
    await mgr.connect(ws, "c1", "u1")
    await stop_subscriber(mgr, "c1")

    await mgr._deliver_local("c1", {"type": "t"})
    assert "u1" not in mgr._rooms["c1"]


# ---------------------------------------------------------------------------
# get_presence
# ---------------------------------------------------------------------------

async def test_get_presence_returns_parsed(mgr, redis):
    redis.hgetall.return_value = {
        b"u1": json.dumps({"user_id": "u1", "display_name": "Alice"}).encode(),
        b"u2": json.dumps({"user_id": "u2", "display_name": "Bob"}).encode(),
    }
    presence = await mgr.get_presence("c1")
    assert len(presence) == 2
    ids = {p["user_id"] for p in presence}
    assert ids == {"u1", "u2"}


async def test_get_presence_skips_malformed(mgr, redis):
    redis.hgetall.return_value = {
        b"u1": b"not-json",
        b"u2": json.dumps({"user_id": "u2"}).encode(),
    }
    presence = await mgr.get_presence("c1")
    assert len(presence) == 1
    assert presence[0]["user_id"] == "u2"


async def test_get_presence_empty(mgr, redis):
    redis.hgetall.return_value = {}
    presence = await mgr.get_presence("c1")
    assert presence == []


# ---------------------------------------------------------------------------
# Redis subscriber fanout (_redis_subscriber)
# ---------------------------------------------------------------------------

async def test_redis_subscriber_delivers_message(mgr, redis):
    """Subscriber receives a Redis message and fans out to local WS."""
    ws = make_ws()
    mgr._rooms["c1"] = {"u1": ws}

    message = {"type": "cursor_update", "x": 10, "y": 20}
    raw = json.dumps({**message, "_exclude": None})

    pubsub = make_pubsub(messages=[
        {"type": "subscribe", "data": 1},
        {"type": "message", "data": raw.encode()},
    ])
    redis.pubsub.return_value = pubsub

    task = asyncio.create_task(mgr._redis_subscriber("c1"))
    # Give the subscriber time to process the message, then cancel
    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):
        pass

    ws.send_json.assert_awaited_with(message)


async def test_redis_subscriber_respects_exclude(mgr, redis):
    ws1, ws2 = make_ws(), make_ws()
    mgr._rooms["c1"] = {"u1": ws1, "u2": ws2}

    message = {"type": "t", "_exclude": "u1"}
    raw = json.dumps(message)

    pubsub = make_pubsub(messages=[
        {"type": "message", "data": raw.encode()},
    ])
    redis.pubsub.return_value = pubsub

    task = asyncio.create_task(mgr._redis_subscriber("c1"))
    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):
        pass

    ws1.send_json.assert_not_awaited()
    ws2.send_json.assert_awaited_once()


async def test_redis_subscriber_skips_non_message_types(mgr, redis):
    """subscribe/psubscribe/unsubscribe message types should be ignored."""
    ws = make_ws()
    mgr._rooms["c1"] = {"u1": ws}

    pubsub = make_pubsub(messages=[
        {"type": "subscribe", "data": 1},
        {"type": "psubscribe", "data": 1},
    ])
    redis.pubsub.return_value = pubsub

    task = asyncio.create_task(mgr._redis_subscriber("c1"))
    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):
        pass

    ws.send_json.assert_not_awaited()


async def test_redis_subscriber_bad_json_continues(mgr, redis):
    """Malformed JSON in a message is caught; subscriber keeps running."""
    ws = make_ws()
    mgr._rooms["c1"] = {"u1": ws}

    good_msg = json.dumps({"type": "cursor_update", "x": 1, "y": 2, "_exclude": None})
    pubsub = make_pubsub(messages=[
        {"type": "message", "data": b"not-valid-json"},  # triggers inner except
        {"type": "message", "data": good_msg.encode()},  # should still be delivered
    ])
    redis.pubsub.return_value = pubsub

    task = asyncio.create_task(mgr._redis_subscriber("c1"))
    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):
        pass

    # The good message should still have been delivered
    ws.send_json.assert_awaited_once()


async def test_send_to_user_exception_swallowed(mgr):
    """Exception raised by send_json is caught — does not propagate."""
    ws = make_ws()
    ws.send_json.side_effect = Exception("write failed")
    await mgr.connect(ws, "c1", "u1")
    await stop_subscriber(mgr, "c1")

    # Should not raise
    await mgr.send_to_user("c1", "u1", {"type": "ping"})


async def test_disconnect_calls_stop_subscriber(mgr, redis):
    """Disconnecting the last user in a room stops the running subscriber task."""
    ws = make_ws()
    await mgr.connect(ws, "c1", "u1")

    task = mgr._subscribers["c1"]
    assert not task.done()

    await mgr.disconnect("c1", "u1")

    assert "c1" not in mgr._rooms
    assert "c1" not in mgr._subscribers
    assert task.done()
