"""Tests for app/utils/memory_manager.py"""

import asyncio
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timedelta

import app.utils.memory_manager as mm_module
from app.utils.memory_manager import (
    RequestPriority,
    QueuedRequest,
    MemoryManager,
    get_memory_manager,
    initialize_memory_manager,
    shutdown_memory_manager,
)


# ── RequestPriority ───────────────────────────────────────────────────────────


def test_priority_values():
    assert RequestPriority.LOW.value < RequestPriority.NORMAL.value < RequestPriority.HIGH.value


# ── QueuedRequest ─────────────────────────────────────────────────────────────


def test_queued_request_post_init():
    async def cb(): pass
    req = QueuedRequest(
        request_id="test",
        priority=RequestPriority.NORMAL,
        estimated_memory_mb=128,
        created_at=datetime.now(),
        timeout_seconds=300,
        callback=cb,
    )
    assert req.estimated_memory_bytes == 128 * 1024 * 1024


# ── MemoryManager basic state ─────────────────────────────────────────────────


@pytest.fixture
def manager():
    return MemoryManager(max_memory_mb=256, memory_threshold=0.8, max_queue_size=10)


def test_init_sets_fields(manager):
    assert manager.max_memory_bytes == 256 * 1024 * 1024
    assert manager.memory_threshold == 0.8
    assert manager.max_queue_size == 10
    assert not manager._running


# ── get_memory_usage / get_memory_pressure ────────────────────────────────────


def test_get_memory_usage_returns_dict(manager):
    usage = manager.get_memory_usage()
    assert "process_rss_mb" in usage
    assert "system_total_mb" in usage
    assert "memory_pressure" in usage


def test_get_memory_pressure_float(manager):
    pressure = manager.get_memory_pressure()
    assert isinstance(pressure, float)
    assert pressure >= 0.0


def test_get_memory_usage_error_returns_error_key(manager):
    with patch.object(manager.process, "memory_info", side_effect=Exception("fail")):
        result = manager.get_memory_usage()
        assert "error" in result


def test_get_memory_pressure_on_exception(manager):
    with patch.object(manager.process, "memory_info", side_effect=Exception("fail")):
        assert manager.get_memory_pressure() == 0.0


# ── is_memory_available ───────────────────────────────────────────────────────


def test_is_memory_available_on_exception(manager):
    with patch.object(manager, "get_memory_pressure", side_effect=Exception("boom")):
        assert manager.is_memory_available(10) is False


def test_is_memory_available_low_pressure(manager):
    with patch.object(manager.process, "memory_info") as mock_info:
        mock_info.return_value = MagicMock(rss=1024 * 1024)  # 1 MB
        result = manager.is_memory_available(1)
        assert isinstance(result, bool)


# ── queue_request ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_queue_request_executes_immediately_when_memory_available(manager):
    called = []

    async def cb():
        called.append(True)

    with patch.object(manager, "is_memory_available", return_value=True):
        result = await manager.queue_request("req1", cb, estimated_memory_mb=10)
    assert result is True
    assert called


@pytest.mark.asyncio
async def test_queue_request_returns_false_on_immediate_execution_failure(manager):
    async def bad_cb():
        raise RuntimeError("boom")

    with patch.object(manager, "is_memory_available", return_value=True):
        result = await manager.queue_request("req2", bad_cb)
    assert result is False


@pytest.mark.asyncio
async def test_queue_request_queues_when_memory_unavailable(manager):
    async def cb(): pass

    with patch.object(manager, "is_memory_available", return_value=False):
        result = await manager.queue_request("req3", cb, priority=RequestPriority.HIGH)
    assert result is True
    assert manager.request_queue.qsize() > 0


@pytest.mark.asyncio
async def test_queue_request_rejects_when_queue_full(manager):
    async def cb(): pass

    manager.max_queue_size = 0
    with patch.object(manager, "is_memory_available", return_value=False):
        result = await manager.queue_request("req4", cb)
    assert result is False
    assert manager.stats["rejected_requests"] == 1


# ── get_queue_status ──────────────────────────────────────────────────────────


def test_get_queue_status(manager):
    status = manager.get_queue_status()
    assert "queue_size" in status
    assert "active_requests" in status
    assert "stats" in status


# ── cancel_request ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cancel_existing_request(manager):
    async def cb(): pass

    with patch.object(manager, "is_memory_available", return_value=False):
        await manager.queue_request("cancel-me", cb)
    assert manager.cancel_request("cancel-me") is True
    assert "cancel-me" not in manager.active_requests


def test_cancel_nonexistent_request(manager):
    assert manager.cancel_request("ghost") is False


# ── start / stop ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_start_and_stop(manager):
    await manager.start()
    assert manager._running
    await manager.stop()
    assert not manager._running


@pytest.mark.asyncio
async def test_start_idempotent(manager):
    await manager.start()
    await manager.start()  # second call should be no-op
    assert manager._running
    await manager.stop()


# ── _cleanup_expired_requests ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cleanup_expired_requests(manager):
    async def cb(): pass

    old_req = QueuedRequest(
        request_id="expired",
        priority=RequestPriority.NORMAL,
        estimated_memory_mb=10,
        created_at=datetime.now() - timedelta(seconds=1000),
        timeout_seconds=1,
        callback=cb,
    )
    manager.active_requests["expired"] = old_req
    await manager._cleanup_expired_requests()
    assert "expired" not in manager.active_requests


# ── _force_garbage_collection ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_force_garbage_collection_high_pressure(manager):
    with patch.object(manager, "get_memory_pressure", return_value=0.9):
        with patch("gc.collect", return_value=5) as mock_gc:
            await manager._force_garbage_collection()
            mock_gc.assert_called_once()


@pytest.mark.asyncio
async def test_force_garbage_collection_low_pressure(manager):
    with patch.object(manager, "get_memory_pressure", return_value=0.3):
        with patch("gc.collect") as mock_gc:
            await manager._force_garbage_collection()
            mock_gc.assert_not_called()


# ── global helpers ────────────────────────────────────────────────────────────


def test_get_memory_manager_singleton():
    mm_module._memory_manager = None
    m1 = get_memory_manager()
    m2 = get_memory_manager()
    assert m1 is m2
    mm_module._memory_manager = None


@pytest.mark.asyncio
async def test_initialize_and_shutdown_memory_manager():
    mm_module._memory_manager = None
    mgr = await initialize_memory_manager()
    assert mgr._running
    await shutdown_memory_manager()
    assert mm_module._memory_manager is None


@pytest.mark.asyncio
async def test_shutdown_noop_when_none():
    mm_module._memory_manager = None
    await shutdown_memory_manager()  # should not raise


# ── _process_queue internal branches ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_process_queue_handles_timed_out_request(manager):
    """Lines 226-229: request with expired timeout is discarded."""
    called = []

    async def cb():
        called.append(True)

    old_req = QueuedRequest(
        request_id="expired",
        priority=RequestPriority.NORMAL,
        estimated_memory_mb=10,
        created_at=datetime.now() - timedelta(seconds=1000),
        timeout_seconds=1,
        callback=cb,
    )
    manager.active_requests["expired"] = old_req
    # Put the expired request directly in the queue
    await manager.request_queue.put((-2, 0.0, old_req))

    manager._running = True
    task = asyncio.create_task(manager._process_queue())
    await asyncio.sleep(0.05)
    manager._running = False
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert "expired" not in manager.active_requests
    assert not called


@pytest.mark.asyncio
async def test_process_queue_timeout_continues(manager):
    """Line 223: asyncio.TimeoutError causes loop to continue (empty queue)."""
    call_count = [0]

    async def fake_wait_for(*args, **kwargs):
        call_count[0] += 1
        if call_count[0] >= 2:
            manager._running = False
        raise asyncio.TimeoutError()

    manager._running = True
    with patch("app.utils.memory_manager.asyncio.wait_for", side_effect=fake_wait_for):
        task = asyncio.create_task(manager._process_queue())
        for _ in range(20):
            await asyncio.sleep(0)
        manager._running = False
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    assert call_count[0] >= 1


@pytest.mark.asyncio
async def test_process_queue_requeues_when_memory_unavailable(manager):
    """Lines 232-236: request re-queued when memory pressure is high."""
    calls = []
    stop_event = asyncio.Event()

    async def cb():
        calls.append(True)

    req = QueuedRequest(
        request_id="mem-req",
        priority=RequestPriority.NORMAL,
        estimated_memory_mb=10,
        created_at=datetime.now(),
        timeout_seconds=300,
        callback=cb,
    )
    manager.active_requests["mem-req"] = req
    await manager.request_queue.put((-2, 0.0, req))

    call_count = [0]
    original_is_available = manager.is_memory_available

    def controlled_is_available(mb):
        call_count[0] += 1
        if call_count[0] >= 2:
            manager._running = False
        return False

    # Use a yielding sleep mock so the task can make progress without real 1s delay
    original_sleep = asyncio.sleep

    async def yielding_sleep(delay):
        await original_sleep(0)  # yield without actual wait

    manager._running = True
    with patch.object(manager, "is_memory_available", side_effect=controlled_is_available):
        with patch("app.utils.memory_manager.asyncio.sleep", new=yielding_sleep):
            task = asyncio.create_task(manager._process_queue())
            for _ in range(20):
                await original_sleep(0)
            manager._running = False
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    assert not calls  # request should not have been executed


@pytest.mark.asyncio
async def test_process_queue_successful_execution(manager):
    """Line 241: successful execution removes from active_requests."""
    called = []

    async def cb():
        called.append(True)

    req = QueuedRequest(
        request_id="ok-req",
        priority=RequestPriority.NORMAL,
        estimated_memory_mb=10,
        created_at=datetime.now(),
        timeout_seconds=300,
        callback=cb,
    )
    manager.active_requests["ok-req"] = req
    await manager.request_queue.put((-2, 0.0, req))

    manager._running = True
    with patch.object(manager, "is_memory_available", return_value=True):
        task = asyncio.create_task(manager._process_queue())
        for _ in range(20):
            await asyncio.sleep(0)
        manager._running = False
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    assert called
    assert "ok-req" not in manager.active_requests


@pytest.mark.asyncio
async def test_process_queue_handles_execution_failure(manager):
    """Lines 242-244: execution failure is caught and logged."""
    async def bad_cb():
        raise RuntimeError("execution failed")

    req = QueuedRequest(
        request_id="fail-req",
        priority=RequestPriority.NORMAL,
        estimated_memory_mb=10,
        created_at=datetime.now(),
        timeout_seconds=300,
        callback=bad_cb,
    )
    manager.active_requests["fail-req"] = req
    await manager.request_queue.put((-2, 0.0, req))

    manager._running = True
    with patch.object(manager, "is_memory_available", return_value=True):
        task = asyncio.create_task(manager._process_queue())
        await asyncio.sleep(0.1)
        manager._running = False
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    assert "fail-req" not in manager.active_requests


@pytest.mark.asyncio
async def test_process_queue_outer_exception_handled(manager):
    """Lines 247-248: outer exception in _process_queue is caught and loop continues."""
    call_count = [0]

    original_get = manager.request_queue.get

    async def exploding_get():
        call_count[0] += 1
        if call_count[0] >= 2:
            manager._running = False
            return await original_get()  # won't reach here since _running=False breaks loop
        raise RuntimeError("queue exploded")

    manager._running = True
    with patch.object(manager.request_queue, "get", side_effect=exploding_get):
        task = asyncio.create_task(manager._process_queue())
        for _ in range(20):
            await asyncio.sleep(0)
        manager._running = False
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    assert call_count[0] >= 1


@pytest.mark.asyncio
async def test_execute_request_tracks_in_processing(manager):
    """Line 258: request in active_requests is also tracked in processing_requests."""
    async def cb(): pass

    req = QueuedRequest(
        request_id="track-req",
        priority=RequestPriority.NORMAL,
        estimated_memory_mb=10,
        created_at=datetime.now(),
        timeout_seconds=300,
        callback=cb,
    )
    manager.active_requests["track-req"] = req
    await manager._execute_request("track-req", cb)
    # After execution, it's removed from processing_requests
    assert "track-req" not in manager.processing_requests


# ── _cleanup_loop ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cleanup_loop_runs_and_stops(manager):
    """Lines 274-280: cleanup loop body executes."""
    manager.cleanup_interval = 0  # use real sleep(0) so event loop yields
    manager._running = True
    call_count = []

    original_cleanup = manager._cleanup_expired_requests

    async def counting_cleanup():
        call_count.append(1)
        manager._running = False  # stop after first iteration
        await original_cleanup()

    with patch.object(manager, "_cleanup_expired_requests", side_effect=counting_cleanup):
        with patch.object(manager, "_force_garbage_collection", new_callable=AsyncMock):
            task = asyncio.create_task(manager._cleanup_loop())
            # yield control to let the task run
            for _ in range(10):
                await asyncio.sleep(0)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    assert len(call_count) >= 1


@pytest.mark.asyncio
async def test_cleanup_loop_handles_exception(manager):
    """Lines 279-280: exception inside cleanup loop body is caught and logged."""
    manager.cleanup_interval = 0
    manager._running = True
    call_count = []

    async def failing_cleanup():
        call_count.append(1)
        manager._running = False  # stop after first failure
        raise RuntimeError("cleanup failed")

    with patch.object(manager, "_cleanup_expired_requests", side_effect=failing_cleanup):
        with patch.object(manager, "_force_garbage_collection", new_callable=AsyncMock):
            task = asyncio.create_task(manager._cleanup_loop())
            for _ in range(10):
                await asyncio.sleep(0)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    assert len(call_count) >= 1
