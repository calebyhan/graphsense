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
from unittest.mock import MagicMock  # noqa: E402
