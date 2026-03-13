"""
Unit tests for LockManager.
All Redis calls are replaced with AsyncMock — no real Redis connection needed.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.lock_manager import LockManager


@pytest.fixture
def redis():
    r = AsyncMock()
    return r


@pytest.fixture
def mgr(redis):
    return LockManager(redis)


# ---------------------------------------------------------------------------
# acquire
# ---------------------------------------------------------------------------

async def test_acquire_success(mgr, redis):
    redis.set.return_value = True  # SET NX returns value when key is set
    result = await mgr.acquire("canvas1", "elem1", "user1")
    assert result is True
    redis.set.assert_awaited_once_with(
        "canvas:canvas1:lock:elem1", "user1", nx=True, ex=30
    )


async def test_acquire_denied(mgr, redis):
    redis.set.return_value = None  # SET NX returns None when key already exists
    result = await mgr.acquire("canvas1", "elem1", "user2")
    assert result is False


# ---------------------------------------------------------------------------
# renew
# ---------------------------------------------------------------------------

async def test_renew_success(mgr, redis):
    redis.get.return_value = b"user1"
    result = await mgr.renew("canvas1", "elem1", "user1")
    assert result is True
    redis.expire.assert_awaited_once_with("canvas:canvas1:lock:elem1", 30)


async def test_renew_not_holder(mgr, redis):
    redis.get.return_value = b"user2"
    result = await mgr.renew("canvas1", "elem1", "user1")
    assert result is False
    redis.expire.assert_not_awaited()


async def test_renew_no_lock(mgr, redis):
    redis.get.return_value = None
    result = await mgr.renew("canvas1", "elem1", "user1")
    assert result is False


# ---------------------------------------------------------------------------
# release
# ---------------------------------------------------------------------------

async def test_release_success(mgr, redis):
    redis.eval.return_value = 1
    result = await mgr.release("canvas1", "elem1", "user1")
    assert result is True
    redis.eval.assert_awaited_once()
    # Verify the Lua script and args are passed correctly
    call_args = redis.eval.await_args
    assert call_args.args[1] == 1  # num keys
    assert call_args.args[2] == "canvas:canvas1:lock:elem1"
    assert call_args.args[3] == "user1"


async def test_release_not_holder(mgr, redis):
    redis.eval.return_value = 0
    result = await mgr.release("canvas1", "elem1", "user2")
    assert result is False


# ---------------------------------------------------------------------------
# get_holder
# ---------------------------------------------------------------------------

async def test_get_holder_exists(mgr, redis):
    redis.get.return_value = b"user1"
    holder = await mgr.get_holder("canvas1", "elem1")
    assert holder == "user1"


async def test_get_holder_none(mgr, redis):
    redis.get.return_value = None
    holder = await mgr.get_holder("canvas1", "elem1")
    assert holder is None


# ---------------------------------------------------------------------------
# release_all_for_user
# ---------------------------------------------------------------------------

async def test_release_all_for_user(mgr, redis):
    # Simulate two lock keys, one held by user1 and one by user2
    keys = [b"canvas:canvas1:lock:elem1", b"canvas:canvas1:lock:elem2"]

    async def fake_scan_iter(pattern):
        for k in keys:
            yield k

    redis.scan_iter = fake_scan_iter
    redis.get.side_effect = [b"user1", b"user2"]
    redis.delete = AsyncMock()

    released = await mgr.release_all_for_user("canvas1", "user1")

    assert released == ["elem1"]
    redis.delete.assert_awaited_once_with(b"canvas:canvas1:lock:elem1")


async def test_release_all_for_user_none_held(mgr, redis):
    async def fake_scan_iter(pattern):
        return
        yield  # make it an async generator

    redis.scan_iter = fake_scan_iter
    released = await mgr.release_all_for_user("canvas1", "user1")
    assert released == []


# ---------------------------------------------------------------------------
# get_all_locks
# ---------------------------------------------------------------------------

async def test_get_all_locks(mgr, redis):
    keys = [b"canvas:canvas1:lock:elem1", b"canvas:canvas1:lock:elem2"]

    async def fake_scan_iter(pattern):
        for k in keys:
            yield k

    redis.scan_iter = fake_scan_iter
    redis.get.side_effect = [b"user1", b"user2"]

    locks = await mgr.get_all_locks("canvas1")

    assert locks == {"elem1": "user1", "elem2": "user2"}


async def test_get_all_locks_empty(mgr, redis):
    async def fake_scan_iter(pattern):
        return
        yield

    redis.scan_iter = fake_scan_iter
    locks = await mgr.get_all_locks("canvas1")
    assert locks == {}


async def test_lock_ttl_constant(mgr):
    assert mgr.LOCK_TTL == 30


async def test_lock_key_format(mgr):
    assert mgr._key("cvs", "el") == "canvas:cvs:lock:el"
