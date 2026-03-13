"""
Unit tests for DataProfilerAgent — pure Python/pandas, no AI calls.
"""

import pandas as pd
import pytest

from app.models.processing_context import ProcessingContext
from app.agents.data_profiler_agent import DataProfilerAgent


@pytest.fixture
def profiler():
    return DataProfilerAgent()


@pytest.fixture
def context():
    data = [
        {"age": 30, "salary": 70000, "dept": "Engineering"},
        {"age": 25, "salary": 55000, "dept": "Marketing"},
        {"age": 35, "salary": 90000, "dept": "Engineering"},
        {"age": 28, "salary": 62000, "dept": "Sales"},
        {"age": 32, "salary": 75000, "dept": "Engineering"},
    ]
    return ProcessingContext.create_from_data("test-dataset-id", data)


def test_statistical_summary_keys(profiler, context):
    summary = profiler._compute_statistical_summary(context.sample_data)
    assert "row_count" in summary
    assert "column_count" in summary
    assert "columns" in summary
    assert summary["row_count"] == 5
    assert summary["column_count"] == 3


def test_numeric_column_analysis(profiler, context):
    summary = profiler._compute_statistical_summary(context.sample_data)
    age_info = summary["columns"]["age"]
    assert age_info["analysis_type"] == "numeric"
    assert "mean" in age_info
    assert "std" in age_info
    assert "quartiles" in age_info


def test_categorical_column_analysis(profiler, context):
    summary = profiler._compute_statistical_summary(context.sample_data)
    dept_info = summary["columns"]["dept"]
    assert dept_info["analysis_type"] == "categorical"
    assert "top_values" in dept_info


def test_correlations(profiler, context):
    correlations = profiler._compute_correlations(context.sample_data)
    assert isinstance(correlations, list)
    for corr in correlations:
        assert "column1" in corr
        assert "column2" in corr
        assert "correlation" in corr
        assert -1.0 <= corr["correlation"] <= 1.0


def test_data_quality(profiler, context):
    quality = profiler._compute_data_quality(context.sample_data)
    assert "completeness" in quality
    assert "missing_data" in quality
    assert "duplicates" in quality
    assert quality["completeness"] == 1.0  # No missing values in test data


def test_data_quality_with_missing(profiler):
    data = [
        {"a": 1, "b": None},
        {"a": 2, "b": 3},
        {"a": None, "b": 4},
    ]
    ctx = ProcessingContext.create_from_data("x", data)
    quality = profiler._compute_data_quality(ctx.sample_data)
    assert quality["completeness"] < 1.0
    assert quality["missing_data"]["total_missing"] == 2


def test_outlier_detection(profiler):
    series = pd.Series([10, 11, 12, 10, 11, 200])  # 200 is an outlier
    result = profiler._detect_outliers(series)
    assert result["count"] >= 1


def test_infer_data_type_numeric(profiler):
    assert profiler._infer_data_type(pd.Series([1.0, 2.0, 3.0])) == "numeric"


def test_infer_data_type_categorical(profiler):
    series = pd.Series(["a", "b", "a", "c"] * 5)
    assert profiler._infer_data_type(series) == "categorical"


def test_validate_input_rejects_empty(profiler):
    ctx = MagicMock()
    ctx.sample_data = pd.DataFrame()
    assert profiler.validate_input(ctx) is False


# Avoid import error for MagicMock used above
from unittest.mock import MagicMock, AsyncMock, patch  # noqa: E402


# ── Additional coverage ───────────────────────────────────────────────────────

# _infer_data_type branches

def test_infer_data_type_temporal(profiler):
    series = pd.to_datetime(pd.Series(["2021-01-01", "2021-06-15"]))
    assert profiler._infer_data_type(series) == "temporal"


def test_infer_data_type_bool(profiler):
    # In this pandas version, is_numeric_dtype returns True for bool.
    # Patch it to False so the bool branch is reachable.
    from unittest.mock import patch as _patch
    series = pd.Series([True, False, True])
    with _patch("app.agents.data_profiler_agent.pd.api.types.is_numeric_dtype", return_value=False):
        result = profiler._infer_data_type(series)
    assert result == "categorical"


def test_infer_data_type_text(profiler):
    # High cardinality strings → text
    series = pd.Series([f"unique_value_{i}" for i in range(200)])
    assert profiler._infer_data_type(series) == "text"


# _analyze_numeric_column: all-null branch

def test_analyze_numeric_all_null(profiler):
    series = pd.Series([None, None, None], dtype=float)
    result = profiler._analyze_numeric_column(series)
    assert result["analysis_type"] == "numeric"
    assert result.get("all_null") is True


# _analyze_text_column: empty series

def test_analyze_text_empty_series(profiler):
    series = pd.Series([None, None], dtype=object)
    result = profiler._analyze_text_column(series)
    assert result["analysis_type"] == "text"
    assert result.get("all_null") is True


def test_analyze_text_normal(profiler):
    series = pd.Series(["hello world", "foo", ""])
    result = profiler._analyze_text_column(series)
    assert result["analysis_type"] == "text"
    assert "avg_length" in result
    assert result["empty_strings"] == 1


# _compute_statistical_summary: text column branch (unique_count >= 50)

def test_statistical_summary_text_column(profiler):
    # High-cardinality string column (>= 50 unique values) → text analysis branch
    df = pd.DataFrame({"text_col": [f"unique_val_{i}" for i in range(60)]})
    summary = profiler._compute_statistical_summary(df)
    text_cols = [c for c in summary["columns"].values() if c["analysis_type"] == "text"]
    assert len(text_cols) > 0


# _compute_correlations: no numeric columns → empty list

def test_correlations_no_numeric(profiler):
    df = pd.DataFrame({"a": ["x", "y"], "b": ["p", "q"]})
    result = profiler._compute_correlations(df)
    assert result == []


# _correlation_strength branches

def test_correlation_strength_all_levels(profiler):
    assert profiler._correlation_strength(0.9) == "very_strong"
    assert profiler._correlation_strength(0.65) == "strong"
    assert profiler._correlation_strength(0.45) == "moderate"
    assert profiler._correlation_strength(0.25) == "weak"
    assert profiler._correlation_strength(0.1) == "very_weak"


# _compute_patterns / _analyze_trend / _analyze_distribution / _detect_outliers

def test_compute_patterns(profiler, context):
    patterns = profiler._compute_patterns(context.sample_data)
    assert "trends" in patterns
    assert "outliers" in patterns
    assert "distributions" in patterns


def test_detect_outliers_insufficient_data(profiler):
    series = pd.Series([1.0, 2.0, 3.0])  # < 4 points
    result = profiler._detect_outliers(series)
    assert result["count"] == 0
    assert result["percentage"] == 0.0


def test_analyze_distribution_exception_path(profiler):
    """Force stats.normaltest to raise so the except branch is covered."""
    series = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
    with patch("app.agents.data_profiler_agent.stats.normaltest", side_effect=ValueError("forced")):
        result = profiler._analyze_distribution(series)
    assert "is_normal" in result
    assert result["is_normal"] is False


def test_analyze_trend_insufficient_data(profiler):
    series = pd.Series([1.0, 2.0])  # < 3 points
    result = profiler._analyze_trend(series)
    assert result["trend"] == "insufficient_data"


def test_analyze_trend_full(profiler):
    series = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
    result = profiler._analyze_trend(series)
    assert "slope" in result
    assert result["trend"] == "increasing"


def test_analyze_distribution_insufficient_data(profiler):
    series = pd.Series([1.0, 2.0])  # < 3 points
    result = profiler._analyze_distribution(series)
    assert result["distribution"] == "insufficient_data"


def test_analyze_distribution_full(profiler):
    import numpy as np
    rng = np.random.default_rng(0)
    series = pd.Series(rng.normal(0, 1, 50))
    result = profiler._analyze_distribution(series)
    assert "is_normal" in result
    assert "skewness" in result


# _assess_consistency: mixed types

def test_assess_consistency_mixed_types(profiler):
    df = pd.DataFrame({"col": [1, "two", 3.0]})
    result = profiler._assess_consistency(df)
    assert isinstance(result["issues"], list)
    assert isinstance(result["score"], float)


# _get_or_compute_* cache hit paths

def test_get_or_compute_statistical_summary_cache_hit(profiler, context):
    context.cache_computation("statistical_summary", {"cached": True})
    result = profiler._get_or_compute_statistical_summary(context, context.sample_data)
    assert result == {"cached": True}


def test_get_or_compute_correlations_cache_hit(profiler, context):
    context.cache_computation("correlations", [{"cached": True}])
    result = profiler._get_or_compute_correlations(context, context.sample_data)
    assert result == [{"cached": True}]


def test_get_or_compute_patterns_cache_hit(profiler, context):
    context.cache_computation("patterns", {"cached": True})
    result = profiler._get_or_compute_patterns(context, context.sample_data)
    assert result == {"cached": True}


def test_get_or_compute_data_quality_cache_hit(profiler, context):
    context.cache_computation("data_quality", {"cached": True})
    result = profiler._get_or_compute_data_quality(context, context.sample_data)
    assert result == {"cached": True}


# _get_ai_insights: success path and failure fallback

async def test_get_ai_insights_success(profiler):
    mock_service = MagicMock()
    mock_service.generate_data_profile_insights = AsyncMock(return_value={"insights": ["great data"]})
    with patch("app.agents.data_profiler_agent.get_gemini_service", return_value=mock_service):
        result = await profiler._get_ai_insights({}, [], {})
    assert result == {"insights": ["great data"]}


async def test_get_ai_insights_failure_fallback(profiler):
    mock_service = MagicMock()
    mock_service.generate_data_profile_insights = AsyncMock(side_effect=Exception("AI down"))
    with patch("app.agents.data_profiler_agent.get_gemini_service", return_value=mock_service):
        result = await profiler._get_ai_insights({}, [], {})
    assert "insights" in result
    assert "data_quality_score" in result


# process() — full pipeline with mocked AI

async def test_process_success(profiler, context):
    mock_service = MagicMock()
    mock_service.generate_data_profile_insights = AsyncMock(return_value={"insights": []})
    with patch("app.agents.data_profiler_agent.get_gemini_service", return_value=mock_service):
        result = await profiler.process(context)
    assert result.success is True
    assert result.confidence > 0


async def test_process_exception_returns_error(profiler):
    """process() with a broken context (sample_data raising) hits the exception path."""
    bad_ctx = MagicMock()
    bad_ctx.sample_data = MagicMock(side_effect=Exception("bad data"))
    bad_ctx.dataset_id = "x"
    result = await profiler.process(bad_ctx)
    assert result.success is False


# get_fallback_result

def test_get_fallback_result_returns_basic_analysis(profiler, context):
    result = profiler.get_fallback_result(context, "some error")
    assert result.success is True
    assert result.confidence == 0.3


def test_get_fallback_result_broken_context(profiler):
    """If accessing sample_data raises, the except branch (lines 443-445) is hit."""
    class _BrokenContext:
        dataset_id = "x"

        @property
        def sample_data(self):
            raise AttributeError("broken")

    result = profiler.get_fallback_result(_BrokenContext(), "original error")
    assert result.success is False
