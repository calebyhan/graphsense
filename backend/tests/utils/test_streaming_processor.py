"""Tests for app/utils/streaming_processor.py"""

import pytest
import gc
from unittest.mock import patch, MagicMock

from app.utils.streaming_processor import MemoryMonitor, StreamingDataProcessor


# ── MemoryMonitor ─────────────────────────────────────────────────────────────


@pytest.fixture
def monitor():
    return MemoryMonitor(memory_limit_mb=512)


def test_memory_monitor_limit(monitor):
    assert monitor.memory_limit_bytes == 512 * 1024 * 1024


def test_get_memory_usage_keys(monitor):
    usage = monitor.get_memory_usage()
    assert "rss" in usage
    assert "vms" in usage
    assert "percent" in usage
    assert "available" in usage


def test_is_memory_available_very_large(monitor):
    # Asking for 0 bytes should always be available
    assert monitor.is_memory_available(0) is True


def test_is_memory_available_too_large(monitor):
    # Asking for more than the limit should return False
    assert monitor.is_memory_available(monitor.memory_limit_bytes + 1) is False


def test_get_memory_pressure_non_negative(monitor):
    pressure = monitor.get_memory_pressure()
    assert pressure >= 0.0


def test_force_garbage_collection_returns_int(monitor):
    result = monitor.force_garbage_collection()
    assert isinstance(result, int)
    assert result >= 0


# ── StreamingDataProcessor ────────────────────────────────────────────────────


@pytest.fixture
def processor():
    return StreamingDataProcessor(chunk_size=100, memory_limit_mb=256, sample_size=50)


def test_processor_init(processor):
    assert processor.chunk_size == 100
    assert processor.processing_stats["total_rows_processed"] == 0
    assert processor.processing_stats["chunks_processed"] == 0


# ── process_csv_stream ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_process_csv_stream_string_input(processor):
    csv_content = "name,age,dept\nAlice,30,Eng\nBob,25,Mktg\nCarol,35,Eng\n"
    result = await processor.process_csv_stream(csv_content, "test.csv")
    assert "data" in result
    assert "metadata" in result
    assert "processing_stats" in result
    assert len(result["data"]) == 3


@pytest.mark.asyncio
async def test_process_csv_stream_bytes_input(processor):
    csv_content = b"x,y\n1,2\n3,4\n"
    result = await processor.process_csv_stream(csv_content, "test.csv")
    assert len(result["data"]) == 2


@pytest.mark.asyncio
async def test_process_csv_stream_metadata_fields(processor):
    csv_content = "a,b\n1,2\n3,4\n"
    result = await processor.process_csv_stream(csv_content)
    meta = result["metadata"]
    assert "original_rows" in meta
    assert "sampled_rows" in meta
    assert "file_size_bytes" in meta
    assert meta["processing_method"] == "streaming"


@pytest.mark.asyncio
async def test_process_csv_stream_large_triggers_sampling():
    proc = StreamingDataProcessor(chunk_size=10, memory_limit_mb=256, sample_size=20)
    rows = "\n".join([f"val{i},{i}" for i in range(200)])
    csv_content = f"col1,col2\n{rows}\n"
    result = await proc.process_csv_stream(csv_content, "big.csv")
    assert len(result["data"]) <= 20


@pytest.mark.asyncio
async def test_process_csv_stream_gc_triggered():
    proc = StreamingDataProcessor(chunk_size=2, memory_limit_mb=256, sample_size=100)
    with patch.object(proc.memory_monitor, "get_memory_pressure", return_value=0.9):
        csv_content = "a,b\n1,2\n3,4\n5,6\n7,8\n"
        result = await proc.process_csv_stream(csv_content)
        assert proc.processing_stats["gc_collections"] > 0


@pytest.mark.asyncio
async def test_process_csv_stream_logs_every_10_chunks():
    # Patch _calculate_optimal_chunk_size to return 1 so we get many chunks
    proc = StreamingDataProcessor(chunk_size=1, memory_limit_mb=256, sample_size=100)
    with patch.object(proc, "_calculate_optimal_chunk_size", return_value=1):
        rows = "\n".join([f"v{i}" for i in range(11)])
        csv_content = f"col\n{rows}\n"
        result = await proc.process_csv_stream(csv_content)
    assert proc.processing_stats["total_rows_processed"] >= 11


@pytest.mark.asyncio
async def test_process_csv_stream_exception_reraises():
    proc = StreamingDataProcessor(chunk_size=100, memory_limit_mb=256, sample_size=50)
    with patch("pandas.read_csv", side_effect=RuntimeError("parse error")):
        with pytest.raises(RuntimeError, match="parse error"):
            await proc.process_csv_stream("a,b\n1,2\n")


# ── process_json_stream ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_process_json_stream_list(processor):
    import json
    data = [{"x": i, "y": i * 2} for i in range(10)]
    json_str = json.dumps(data)
    result = await processor.process_json_stream(json_str, "test.json")
    assert "data" in result
    assert len(result["data"]) == 10


@pytest.mark.asyncio
async def test_process_json_stream_bytes(processor):
    import json
    data = [{"x": i} for i in range(5)]
    result = await processor.process_json_stream(json.dumps(data).encode())
    assert len(result["data"]) == 5


@pytest.mark.asyncio
async def test_process_json_stream_dict_with_data_key(processor):
    import json
    payload = {"data": [{"val": i} for i in range(5)], "meta": "info"}
    result = await processor.process_json_stream(json.dumps(payload))
    assert len(result["data"]) == 5


@pytest.mark.asyncio
async def test_process_json_stream_plain_dict(processor):
    import json
    payload = {"key": "value", "num": 42}
    result = await processor.process_json_stream(json.dumps(payload))
    assert result["data"] == [payload]


@pytest.mark.asyncio
async def test_process_json_stream_filters_non_dicts(processor):
    import json
    data = [{"x": 1}, "bad_string", 42, {"y": 2}]
    result = await processor.process_json_stream(json.dumps(data))
    assert len(result["data"]) == 2


@pytest.mark.asyncio
async def test_process_json_stream_empty_raises():
    proc = StreamingDataProcessor()
    import json
    with pytest.raises(Exception):
        await proc.process_json_stream(json.dumps([]))


@pytest.mark.asyncio
async def test_process_json_stream_invalid_raises():
    proc = StreamingDataProcessor()
    with pytest.raises(Exception):
        await proc.process_json_stream("not json at all")


@pytest.mark.asyncio
async def test_process_json_stream_invalid_structure():
    proc = StreamingDataProcessor()
    import json
    with pytest.raises(Exception):
        await proc.process_json_stream(json.dumps(12345))


# ── _calculate_optimal_chunk_size ────────────────────────────────────────────


def test_calculate_optimal_chunk_size_bounds(processor):
    size = processor._calculate_optimal_chunk_size(1024 * 1024)
    assert 1000 <= size <= 50000


# ── _generate_processing_metadata ────────────────────────────────────────────


def test_generate_processing_metadata(processor):
    meta = processor._generate_processing_metadata(1000, 100, 2048, "test.csv")
    assert meta["original_rows"] == 1000
    assert meta["sampled_rows"] == 100
    assert meta["sampling_ratio"] == pytest.approx(0.1)
    assert meta["is_sampled"] is True
    assert meta["filename"] == "test.csv"


def test_generate_processing_metadata_zero_original(processor):
    meta = processor._generate_processing_metadata(0, 0, 0, "empty.csv")
    assert meta["sampling_ratio"] == 0


# ── get_processing_stats ──────────────────────────────────────────────────────


def test_get_processing_stats(processor):
    stats = processor.get_processing_stats()
    assert "total_rows_processed" in stats
    assert "memory_usage" in stats
    assert "memory_pressure" in stats


@pytest.mark.asyncio
async def test_process_chunk_exception_returns_empty(processor):
    import pandas as pd
    chunk = MagicMock(spec=pd.DataFrame)
    chunk.to_dict.side_effect = RuntimeError("to_dict failure")
    result = await processor._process_chunk(chunk, 0)
    assert result == []
