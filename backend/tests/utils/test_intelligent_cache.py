"""Tests for app/utils/intelligent_cache.py"""

import pytest
import threading
from datetime import datetime
from unittest.mock import patch

import app.utils.intelligent_cache as ic_module
from app.utils.intelligent_cache import (
    CacheMetrics,
    DataFingerprint,
    DataFingerprintGenerator,
    IntelligentCache,
    get_intelligent_cache,
    clear_global_cache,
)
from app.models.analysis import ChartRecommendation, ComprehensiveDataAnalysis


# ── CacheMetrics ──────────────────────────────────────────────────────────────


def test_cache_metrics_initial_state():
    m = CacheMetrics()
    assert m.hits == 0
    assert m.misses == 0
    assert m.total_requests == 0
    assert m.hit_rate == 0.0


def test_cache_metrics_record_hit():
    m = CacheMetrics()
    m.record_hit()
    assert m.hits == 1
    assert m.total_requests == 1
    assert m.hit_rate == pytest.approx(1.0)


def test_cache_metrics_record_miss():
    m = CacheMetrics()
    m.record_miss()
    assert m.misses == 1
    assert m.total_requests == 1
    assert m.hit_rate == pytest.approx(0.0)


def test_cache_metrics_mixed():
    m = CacheMetrics()
    m.record_hit()
    m.record_miss()
    assert m.hit_rate == pytest.approx(0.5)


def test_cache_metrics_reset():
    m = CacheMetrics()
    m.record_hit()
    m.record_hit()
    m.reset()
    assert m.hits == 0
    assert m.total_requests == 0
    assert m.hit_rate == 0.0


def test_cache_metrics_to_dict():
    m = CacheMetrics()
    m.record_hit()
    d = m.to_dict()
    assert d["hits"] == 1
    assert "last_reset" in d
    assert "hit_rate" in d


# ── DataFingerprint ───────────────────────────────────────────────────────────


def test_data_fingerprint_generates_fingerprint():
    fp = DataFingerprint(
        column_types={"a": "numeric"},
        column_count=1,
        row_count=10,
        statistical_hash="abc",
        pattern_hash="def",
    )
    assert len(fp.fingerprint) == 16


def test_data_fingerprint_with_explicit_fingerprint():
    fp = DataFingerprint(
        column_types={},
        column_count=0,
        row_count=0,
        statistical_hash="",
        pattern_hash="",
        fingerprint="preset123",
    )
    assert fp.fingerprint == "preset123"


def test_data_fingerprint_deterministic():
    fp1 = DataFingerprint({"a": "numeric"}, 1, 10, "abc", "def")
    fp2 = DataFingerprint({"a": "numeric"}, 1, 10, "abc", "def")
    assert fp1.fingerprint == fp2.fingerprint


# ── DataFingerprintGenerator ──────────────────────────────────────────────────


def test_fingerprint_generator_empty():
    fp = DataFingerprintGenerator.generate_fingerprint([])
    assert fp.row_count == 0
    assert fp.column_count == 0


def test_fingerprint_generator_basic():
    data = [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]
    fp = DataFingerprintGenerator.generate_fingerprint(data)
    assert fp.column_count == 2
    assert fp.row_count == 2
    assert "name" in fp.column_types
    assert "age" in fp.column_types


def test_fingerprint_generator_numeric_detection():
    data = [{"val": "1.5"}, {"val": "2.5"}]
    fp = DataFingerprintGenerator.generate_fingerprint(data)
    assert fp.column_types["val"] == "numeric"


def test_fingerprint_generator_categorical_detection():
    data = [{"cat": "A"}, {"cat": "B"}, {"cat": "C"}]
    fp = DataFingerprintGenerator.generate_fingerprint(data)
    assert fp.column_types["cat"] == "categorical"


def test_fingerprint_generator_with_nulls():
    data = [{"a": None, "b": 1}, {"a": None, "b": 2}]
    fp = DataFingerprintGenerator.generate_fingerprint(data)
    assert fp.row_count == 2


def test_fingerprint_generator_datetime_object_column():
    # Object column parseable as datetime → line 131
    data = [{"date": "2021-01-01"}, {"date": "2021-06-15"}]
    fp = DataFingerprintGenerator.generate_fingerprint(data)
    assert fp.column_types["date"] == "datetime"


def test_fingerprint_generator_actual_int_column():
    # Actual int dtype (not object) → line 135/136
    import pandas as pd
    df_data = [{"count": 1, "value": 2.5}, {"count": 3, "value": 4.5}]
    fp = DataFingerprintGenerator.generate_fingerprint(df_data)
    assert fp.column_types["count"] == "numeric"
    assert fp.column_types["value"] == "numeric"


def test_fingerprint_generator_actual_datetime_dtype():
    # Pandas datetime64 dtype column → line 137
    import pandas as pd
    df = pd.DataFrame([{"ts": pd.Timestamp("2021-01-01")}, {"ts": pd.Timestamp("2021-06-15")}])
    fp = DataFingerprintGenerator.generate_fingerprint(df.to_dict("records"))
    assert fp.column_types.get("ts") in ("datetime", "numeric", "categorical")


def test_fingerprint_generator_bool_column():
    # Bool dtype → not int/float/datetime/object → line 139
    import pandas as pd
    df = pd.DataFrame([{"flag": True}, {"flag": False}])
    records = df.to_dict("records")
    fp = DataFingerprintGenerator.generate_fingerprint(records)
    assert "flag" in fp.column_types


# ── IntelligentCache ──────────────────────────────────────────────────────────


@pytest.fixture
def cache():
    return IntelligentCache()


def test_cache_init(cache):
    assert len(cache.metrics) == 4
    sizes = cache.get_cache_sizes()
    assert all(v == 0 for v in sizes.values())


# fingerprint

def test_get_data_fingerprint_miss_then_hit(cache):
    data = [{"x": i} for i in range(10)]
    fp1 = cache.get_data_fingerprint(data)
    fp2 = cache.get_data_fingerprint(data)
    assert fp1 == fp2
    assert cache.metrics["fingerprint"].hits == 1


def test_get_data_fingerprint_different_data(cache):
    d1 = [{"x": 1}]
    d2 = [{"y": 2}]
    fp1 = cache.get_data_fingerprint(d1)
    fp2 = cache.get_data_fingerprint(d2)
    assert fp1 != fp2


# analysis

def test_analysis_cache_miss(cache):
    result = cache.get_cached_analysis("unknown_fp")
    assert result is None
    assert cache.metrics["analysis"].misses == 1


def test_analysis_cache_hit(cache):
    mock_analysis = object()
    cache.cache_analysis_result("fp123", mock_analysis)
    result = cache.get_cached_analysis("fp123")
    assert result is mock_analysis
    assert cache.metrics["analysis"].hits == 1


# ai response

def test_ai_response_cache_miss(cache):
    assert cache.get_cached_ai_response("nohash") is None
    assert cache.metrics["ai_response"].misses == 1


def test_ai_response_cache_hit(cache):
    response = {"text": "hello"}
    cache.cache_ai_response("h1", response)
    result = cache.get_cached_ai_response("h1")
    assert result == response
    assert cache.metrics["ai_response"].hits == 1


# chart recommendations

def test_chart_recommendations_cache_miss(cache):
    assert cache.get_cached_chart_recommendations("fp") is None
    assert cache.metrics["chart_config"].misses == 1


def test_chart_recommendations_cache_hit(cache):
    recs = [MagicMock()]
    cache.cache_chart_recommendations("fp42", recs)
    result = cache.get_cached_chart_recommendations("fp42")
    assert result is recs


# prompt hash

def test_generate_prompt_hash_deterministic(cache):
    h1 = cache.generate_prompt_hash("hello", {"k": "v"})
    h2 = cache.generate_prompt_hash("hello", {"k": "v"})
    assert h1 == h2
    assert len(h1) == 16


def test_generate_prompt_hash_different_prompts(cache):
    h1 = cache.generate_prompt_hash("a")
    h2 = cache.generate_prompt_hash("b")
    assert h1 != h2


def test_generate_prompt_hash_no_context(cache):
    h = cache.generate_prompt_hash("prompt")
    assert isinstance(h, str)


# get_cache_metrics

def test_get_cache_metrics(cache):
    metrics = cache.get_cache_metrics()
    assert set(metrics.keys()) == {"fingerprint", "ai_response", "analysis", "chart_config"}
    for v in metrics.values():
        assert "hits" in v


# get_cache_sizes

def test_get_cache_sizes_empty(cache):
    sizes = cache.get_cache_sizes()
    assert all(v == 0 for v in sizes.values())


def test_get_cache_sizes_after_insert(cache):
    cache.cache_ai_response("k", {"r": 1})
    sizes = cache.get_cache_sizes()
    assert sizes["ai_response"] == 1


# clear_cache

def test_clear_all_caches(cache):
    cache.cache_ai_response("k", {})
    cache.get_cached_analysis("x")
    cache.clear_cache()
    sizes = cache.get_cache_sizes()
    assert all(v == 0 for v in sizes.values())
    # Metrics reset too
    assert cache.metrics["ai_response"].total_requests == 0


def test_clear_specific_cache(cache):
    cache.cache_ai_response("k", {})
    cache.cache_chart_recommendations("f", [])
    cache.clear_cache("ai_response")
    sizes = cache.get_cache_sizes()
    assert sizes["ai_response"] == 0
    assert sizes["chart_config"] == 1


def test_clear_fingerprint_cache(cache):
    data = [{"x": 1}]
    cache.get_data_fingerprint(data)  # populate fingerprint cache
    cache.clear_cache("fingerprint")
    assert cache.get_cache_sizes()["fingerprint"] == 0


def test_clear_analysis_cache(cache):
    cache.cache_analysis_result("fp", object())
    cache.clear_cache("analysis")
    assert cache.get_cache_sizes()["analysis"] == 0


def test_clear_chart_config_cache(cache):
    cache.cache_chart_recommendations("fp", [])
    cache.clear_cache("chart_config")
    assert cache.get_cache_sizes()["chart_config"] == 0


def test_clear_unknown_cache_type_no_error(cache):
    cache.clear_cache("nonexistent")  # should not raise


def test_optimize_cache_high_utilization(cache):
    # Fill ai_response cache close to max (add enough to trigger 90% check)
    # maxsize=200, fill 181+ to be >90%
    for i in range(181):
        cache.cache_ai_response(f"key{i}", {"v": i})
    result = cache.optimize_cache_performance()
    recs = result["recommendations"]
    assert any("full" in r for r in recs)


# optimize_cache_performance

def test_optimize_cache_performance_empty(cache):
    result = cache.optimize_cache_performance()
    assert "recommendations" in result
    assert "actions_taken" in result
    assert "current_metrics" in result
    assert "cache_sizes" in result


def test_optimize_cache_performance_low_hit_rate(cache):
    # Force low hit rate: 0 hits, 20 misses
    m = cache.metrics["analysis"]
    for _ in range(20):
        m.record_miss()
    result = cache.optimize_cache_performance()
    recs = result["recommendations"]
    assert any("low hit rate" in r for r in recs)


def test_optimize_cache_performance_high_hit_rate(cache):
    m = cache.metrics["analysis"]
    for _ in range(20):
        m.record_hit()
    result = cache.optimize_cache_performance()
    recs = result["recommendations"]
    assert any("excellent hit rate" in r for r in recs)


# ── global helpers ────────────────────────────────────────────────────────────


def test_get_intelligent_cache_singleton():
    ic_module._cache_instance = None
    c1 = get_intelligent_cache()
    c2 = get_intelligent_cache()
    assert c1 is c2
    ic_module._cache_instance = None


def test_clear_global_cache():
    ic_module._cache_instance = None
    c = get_intelligent_cache()
    c.cache_ai_response("k", {})
    clear_global_cache()
    assert c.get_cache_sizes()["ai_response"] == 0
    ic_module._cache_instance = None


def test_clear_global_cache_when_none():
    ic_module._cache_instance = None
    clear_global_cache()  # should not raise


# ── thread safety ─────────────────────────────────────────────────────────────


def test_thread_safe_access(cache):
    errors = []

    def worker(n):
        try:
            for i in range(20):
                cache.cache_ai_response(f"k{n}_{i}", {"v": i})
                cache.get_cached_ai_response(f"k{n}_{i}")
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=worker, args=(t,)) for t in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors


# needed for mock usage in cache hit test
from unittest.mock import MagicMock
