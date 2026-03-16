"""
Unit tests for app/models/base.py — 100% coverage.
"""

from datetime import datetime
from app.models.base import (
    DataType,
    ChartType,
    ProcessingStatus,
    AgentType,
    BaseResponse,
    ErrorResponse,
)


class TestDataType:
    def test_values(self):
        assert DataType.NUMERIC == "numeric"
        assert DataType.CATEGORICAL == "categorical"
        assert DataType.TEMPORAL == "temporal"
        assert DataType.TEXT == "text"
        assert DataType.BOOLEAN == "boolean"

    def test_exhaustive(self):
        assert len(DataType) == 5, (
            f"DataType has {len(DataType)} members — add new members to test_values"
        )

    def test_is_str_enum(self):
        assert isinstance(DataType.NUMERIC, str)


class TestChartType:
    def test_values(self):
        assert ChartType.BAR == "bar"
        assert ChartType.COLUMN == "column"
        assert ChartType.LINE == "line"
        assert ChartType.SCATTER == "scatter"
        assert ChartType.PIE == "pie"
        assert ChartType.HISTOGRAM == "histogram"
        assert ChartType.BOX_PLOT == "box_plot"
        assert ChartType.HEATMAP == "heatmap"
        assert ChartType.AREA == "area"
        assert ChartType.TREEMAP == "treemap"
        assert ChartType.SANKEY == "sankey"

    def test_exhaustive(self):
        assert len(ChartType) == 11, (
            f"ChartType has {len(ChartType)} members — add new members to test_values"
        )


class TestProcessingStatus:
    def test_values(self):
        assert ProcessingStatus.PENDING == "pending"
        assert ProcessingStatus.PROCESSING == "processing"
        assert ProcessingStatus.COMPLETED == "completed"
        assert ProcessingStatus.FAILED == "failed"

    def test_exhaustive(self):
        assert len(ProcessingStatus) == 4, (
            f"ProcessingStatus has {len(ProcessingStatus)} members — add new members to test_values"
        )


class TestAgentType:
    def test_values(self):
        assert AgentType.PROFILER == "profiler"
        assert AgentType.RECOMMENDER == "recommender"
        assert AgentType.VALIDATOR == "validator"

    def test_exhaustive(self):
        assert len(AgentType) == 3, (
            f"AgentType has {len(AgentType)} members — add new members to test_values"
        )


class TestBaseResponse:
    def test_success_true(self):
        r = BaseResponse(success=True)
        assert r.success is True
        assert r.message is None
        assert isinstance(r.timestamp, datetime)

    def test_with_message(self):
        r = BaseResponse(success=False, message="oops")
        assert r.message == "oops"

    def test_custom_timestamp(self):
        ts = datetime(2024, 1, 1)
        r = BaseResponse(success=True, timestamp=ts)
        assert r.timestamp == ts


class TestErrorResponse:
    def test_defaults(self):
        r = ErrorResponse(error="something broke")
        assert r.success is False
        assert r.error == "something broke"
        assert r.details is None
        assert r.error_code is None

    def test_full(self):
        r = ErrorResponse(
            error="not found",
            details="record 42 missing",
            error_code="E404",
            message="lookup failed",
        )
        assert r.error_code == "E404"
        assert r.details == "record 42 missing"
        assert r.message == "lookup failed"
