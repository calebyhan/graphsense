"""
Unit tests for app/models/processing_context.py — 100% coverage.
"""

from datetime import datetime
from unittest.mock import patch, MagicMock
import pandas as pd
import pytest

from app.models.processing_context import ProcessingContext


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_ctx(rows=10) -> ProcessingContext:
    # cat column: 2 unique values in 10 rows → 0.2 < 0.5 → classified as categorical
    df = pd.DataFrame({
        "num": [float(i) for i in range(rows)],
        "cat": (["a", "b"] * (rows // 2 + 1))[:rows],
    })
    return ProcessingContext(dataset_id="ds1", sample_data=df, original_size=rows)


# ── __post_init__ / basic construction ───────────────────────────────────────

class TestConstruction:
    def test_creates_successfully(self):
        ctx = _make_ctx()
        assert ctx.dataset_id == "ds1"
        assert ctx.original_size == 10
        assert isinstance(ctx._creation_time, datetime)

    def test_memory_usage_initialized(self):
        ctx = _make_ctx()
        assert ctx._memory_usage_mb >= 0.0


# ── cache_computation ─────────────────────────────────────────────────────────

class TestCacheComputation:
    def test_stores_and_retrieves(self):
        ctx = _make_ctx()
        ctx.cache_computation("result", {"x": 1})
        assert ctx.get_cached_computation("result") == {"x": 1}

    def test_missing_key_returns_none(self):
        ctx = _make_ctx()
        assert ctx.get_cached_computation("missing") is None

    def test_has_cached_true(self):
        ctx = _make_ctx()
        ctx.cache_computation("key", 42)
        assert ctx.has_cached_computation("key") is True

    def test_has_cached_false(self):
        ctx = _make_ctx()
        assert ctx.has_cached_computation("nope") is False

    def test_exception_in_update_is_caught(self):
        ctx = _make_ctx()
        with patch.object(ctx, "_update_memory_usage", side_effect=RuntimeError("boom")):
            # Should not raise; logs a warning instead
            ctx.cache_computation("key", "val")
        # The value was already set before the exception
        assert ctx._computation_cache.get("key") == "val"


# ── column metadata methods ───────────────────────────────────────────────────

class TestColumnMetadata:
    def test_get_column_types_builds_on_first_call(self):
        ctx = _make_ctx()
        types = ctx.get_column_types()
        assert "num" in types
        assert "cat" in types

    def test_get_column_types_uses_cache_on_second_call(self):
        ctx = _make_ctx()
        ctx.get_column_types()
        with patch.object(ctx, "_build_column_metadata", wraps=ctx._build_column_metadata) as mock_build:
            ctx.get_column_types()
            mock_build.assert_not_called()

    def test_get_numeric_columns(self):
        ctx = _make_ctx()
        assert "num" in ctx.get_numeric_columns()

    def test_get_categorical_columns(self):
        ctx = _make_ctx()
        assert "cat" in ctx.get_categorical_columns()

    def test_get_temporal_columns(self):
        df = pd.DataFrame({
            "ts": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
        })
        ctx = ProcessingContext(dataset_id="ds2", sample_data=df, original_size=3)
        assert "ts" in ctx.get_temporal_columns()

    def test_get_text_columns(self):
        # Make a column with many unique values that won't be classified as categorical
        df = pd.DataFrame({
            "desc": [f"unique text {i}" for i in range(200)],
        })
        ctx = ProcessingContext(dataset_id="ds3", sample_data=df, original_size=200)
        assert "desc" in ctx.get_text_columns()

    def test_boolean_column_treated_as_categorical(self):
        # is_numeric_dtype returns True for bool in this pandas version, so mock it
        df = pd.DataFrame({"flag": [True, False, True, False, True]})
        ctx = ProcessingContext(dataset_id="ds4", sample_data=df, original_size=5)
        with patch("app.models.processing_context.pd.api.types.is_numeric_dtype", return_value=False):
            ctx._column_metadata = None  # Force rebuild
            result = ctx.get_categorical_columns()
        assert "flag" in result

    def test_build_column_metadata_exception_sets_empty(self):
        ctx = _make_ctx()
        # Force exception during metadata build by making columns property fail
        with patch.object(type(ctx.sample_data), "columns", new_callable=lambda: property(lambda self: (_ for _ in ()).throw(RuntimeError("fail")))):
            ctx._build_column_metadata()
        assert ctx._column_metadata == {
            "types": {},
            "numeric": [],
            "categorical": [],
            "temporal": [],
            "text": [],
        }


# ── _infer_data_type ──────────────────────────────────────────────────────────

class TestInferDataType:
    def test_numeric(self):
        ctx = _make_ctx()
        assert ctx._infer_data_type(pd.Series([1, 2, 3])) == "numeric"

    def test_temporal(self):
        ctx = _make_ctx()
        s = pd.to_datetime(["2024-01-01", "2024-01-02"])
        assert ctx._infer_data_type(s) == "temporal"

    def test_boolean(self):
        # is_numeric_dtype returns True for bool in this pandas; mock it to hit the bool branch
        ctx = _make_ctx()
        with patch("app.models.processing_context.pd.api.types.is_numeric_dtype", return_value=False):
            result = ctx._infer_data_type(pd.Series([True, False, True]))
        assert result == "categorical"

    def test_categorical_low_cardinality(self):
        ctx = _make_ctx()
        s = pd.Series(["a", "b", "a", "b", "c"] * 10)
        assert ctx._infer_data_type(s) == "categorical"

    def test_text_high_cardinality(self):
        ctx = _make_ctx()
        s = pd.Series([f"unique_{i}" for i in range(200)])
        assert ctx._infer_data_type(s) == "text"

    def test_exception_returns_text(self):
        ctx = _make_ctx()
        with patch("app.models.processing_context.pd.api.types.is_numeric_dtype", side_effect=RuntimeError("fail")):
            result = ctx._infer_data_type(pd.Series([1, 2, 3]))
        assert result == "text"


# ── estimate_memory_usage ────────────────────────────────────────────────────

class TestEstimateMemoryUsage:
    def test_returns_float(self):
        ctx = _make_ctx()
        mem = ctx.estimate_memory_usage()
        assert isinstance(mem, float)
        assert mem >= 0.0

    def test_with_dataframe_in_cache(self):
        ctx = _make_ctx()
        # Use a large enough DataFrame so memory_usage rounds above 0.0
        ctx.cache_computation("df_cache", pd.DataFrame({"x": list(range(10000))}))
        mem = ctx.estimate_memory_usage()
        assert mem > 0.0

    def test_with_dict_in_cache(self):
        ctx = _make_ctx()
        ctx.cache_computation("meta", {"key": "val"})
        mem = ctx.estimate_memory_usage()
        assert mem >= 0.0

    def test_with_list_in_cache(self):
        ctx = _make_ctx()
        ctx.cache_computation("lst", [1, 2, 3])
        mem = ctx.estimate_memory_usage()
        assert mem >= 0.0

    def test_exception_returns_zero(self):
        ctx = _make_ctx()
        with patch.object(ctx.sample_data, "memory_usage", side_effect=RuntimeError("fail")):
            mem = ctx.estimate_memory_usage()
        assert mem == 0.0


# ── get_processing_stats ──────────────────────────────────────────────────────

class TestGetProcessingStats:
    def test_returns_expected_keys(self):
        ctx = _make_ctx()
        stats = ctx.get_processing_stats()
        assert stats["dataset_id"] == "ds1"
        assert stats["sample_rows"] == 10
        assert stats["sample_columns"] == 2
        assert stats["original_size"] == 10
        assert "cached_computations" in stats
        assert "memory_usage_mb" in stats
        assert "processing_time_seconds" in stats
        assert stats["processing_time_seconds"] >= 0


# ── cleanup ───────────────────────────────────────────────────────────────────

class TestCleanup:
    def test_clears_cache_and_metadata(self):
        ctx = _make_ctx()
        ctx.cache_computation("key", "val")
        ctx.get_column_types()  # populate metadata
        ctx.cleanup()
        assert ctx._computation_cache == {}
        assert ctx._column_metadata is None

    def test_truncates_large_dataframe(self):
        # cleanup() truncates to 100 rows (see processing_context.py `iloc[:100]`)
        df = pd.DataFrame({"x": range(2000)})
        ctx = ProcessingContext(dataset_id="big", sample_data=df, original_size=2000)
        ctx.cleanup()
        assert len(ctx.sample_data) == 100

    def test_small_dataframe_not_truncated(self):
        ctx = _make_ctx(rows=5)
        ctx.cleanup()
        assert len(ctx.sample_data) == 5

    def test_exception_is_caught(self):
        ctx = _make_ctx()
        # Trigger exception at the end of cleanup by making _update_memory_usage raise
        with patch.object(ctx, "_update_memory_usage", side_effect=RuntimeError("fail")):
            # Should not raise; except block logs the error
            ctx.cleanup()


# ── create_from_data ──────────────────────────────────────────────────────────

class TestCreateFromData:
    def test_small_dataset(self):
        data = [{"a": i, "b": str(i)} for i in range(10)]
        ctx = ProcessingContext.create_from_data("ds1", data)
        assert ctx.original_size == 10
        assert len(ctx.sample_data) == 10

    def test_large_dataset_sampled(self):
        data = [{"a": i} for i in range(6000)]
        ctx = ProcessingContext.create_from_data("ds2", data, max_sample_size=5000)
        assert ctx.original_size == 6000
        assert len(ctx.sample_data) == 5000

    def test_exception_raises_value_error(self):
        with patch("pandas.DataFrame", side_effect=RuntimeError("bad data")):
            with pytest.raises(ValueError, match="Failed to create processing context"):
                ProcessingContext.create_from_data("ds3", [{"a": 1}])


# ── get_system_memory_info ────────────────────────────────────────────────────

class TestGetSystemMemoryInfo:
    def test_returns_expected_keys(self):
        ctx = _make_ctx()
        mock_vm = MagicMock(total=16 * 1024**3, available=8 * 1024**3, percent=50.0)
        mock_proc_inst = MagicMock()
        mock_proc_inst.memory_info.return_value = MagicMock(rss=500 * 1024**2)
        with patch("app.models.processing_context.psutil.virtual_memory", return_value=mock_vm), \
             patch("app.models.processing_context.psutil.Process", return_value=mock_proc_inst):
            info = ctx.get_system_memory_info()
        assert info["total_gb"] == 16.0
        assert info["available_gb"] == 8.0
        assert info["used_percent"] == 50.0
        assert info["process_memory_mb"] == 500.0

    def test_exception_returns_empty_dict(self):
        ctx = _make_ctx()
        with patch("app.models.processing_context.psutil.virtual_memory", side_effect=RuntimeError("fail")):
            result = ctx.get_system_memory_info()
        assert result == {}
