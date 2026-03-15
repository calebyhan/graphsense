"""
Unit tests for app/models/dataset.py — 100% coverage.
"""

from datetime import datetime
import uuid
import pytest
from pydantic import ValidationError
from app.models.dataset import (
    ColumnProfile,
    DataQualityIssue,
    ProcessedDataset,
    DataProfile,
    Dataset,
    CreateDatasetRequest,
    CreateDatasetResponse,
)
from app.models.base import DataType, ProcessingStatus


class TestColumnProfile:
    def test_defaults(self):
        cp = ColumnProfile(name="age", data_type=DataType.NUMERIC)
        assert cp.null_count == 0
        assert cp.null_percentage == 0.0
        assert cp.unique_count == 0
        assert cp.unique_percentage == 0.0
        assert cp.sample_values == []
        assert cp.distribution_summary == {}

    def test_percentage_clamped_above(self):
        cp = ColumnProfile(name="x", data_type=DataType.CATEGORICAL, null_percentage=150.0)
        assert cp.null_percentage == 100.0

    def test_percentage_clamped_below(self):
        cp = ColumnProfile(name="x", data_type=DataType.CATEGORICAL, null_percentage=-10.0)
        assert cp.null_percentage == 0.0

    def test_unique_percentage_clamped(self):
        cp = ColumnProfile(name="x", data_type=DataType.TEXT, unique_percentage=200.0)
        assert cp.unique_percentage == 100.0

    def test_valid_percentage(self):
        cp = ColumnProfile(name="x", data_type=DataType.BOOLEAN, null_percentage=50.0, unique_percentage=75.0)
        assert cp.null_percentage == 50.0
        assert cp.unique_percentage == 75.0


class TestDataQualityIssue:
    def test_basic(self):
        issue = DataQualityIssue(
            column="price",
            issue_type="missing_values",
            severity="high",
            description="30% missing",
        )
        assert issue.suggestion is None

    def test_with_suggestion(self):
        issue = DataQualityIssue(
            column="price",
            issue_type="outliers",
            severity="low",
            description="some outliers",
            suggestion="consider removing",
        )
        assert issue.suggestion == "consider removing"


class TestProcessedDataset:
    def test_id_generated(self):
        ds = ProcessedDataset(
            filename="data.csv",
            file_size=1024,
            file_type="csv",
            columns={"a": DataType.NUMERIC},
            row_count=100,
        )
        assert uuid.UUID(ds.id).version == 4

    def test_file_type_lowercased(self):
        ds = ProcessedDataset(
            filename="data.CSV",
            file_size=512,
            file_type="CSV",
            columns={},
            row_count=10,
        )
        assert ds.file_type == "csv"

    @pytest.mark.parametrize("ft", ["csv", "json", "xlsx", "xls", "tsv"])
    def test_valid_file_types(self, ft):
        ds = ProcessedDataset(
            filename=f"f.{ft}",
            file_size=1,
            file_type=ft,
            columns={},
            row_count=1,
        )
        assert ds.file_type == ft

    def test_invalid_file_type_raises(self):
        with pytest.raises(ValidationError):
            ProcessedDataset(
                filename="data.pdf",
                file_size=1,
                file_type="pdf",
                columns={},
                row_count=1,
            )

    def test_defaults(self):
        ds = ProcessedDataset(
            filename="x.json",
            file_size=0,
            file_type="json",
            columns={},
            row_count=0,
        )
        assert ds.sample_data == []
        assert ds.metadata == {}


class TestDataProfile:
    def test_basic(self):
        dp = DataProfile(
            dataset_id="ds1",
            column_profiles={"age": ColumnProfile(name="age", data_type=DataType.NUMERIC)},
        )
        assert dp.correlations == {}
        assert dp.data_quality_issues == []
        assert dp.statistical_summary == {}
        assert dp.processing_time_ms == 0


class TestDataset:
    def test_basic(self):
        now = datetime.now()
        ds = Dataset(
            id="id1",
            user_id="u1",
            filename="test.csv",
            file_size=2048,
            file_type="csv",
            processing_timestamp=now,
            processing_status=ProcessingStatus.COMPLETED,
            created_at=now,
            updated_at=now,
        )
        assert ds.data_profile is None
        assert ds.sample_data is None
        assert ds.metadata is None

    def test_with_optional(self):
        now = datetime.now()
        ds = Dataset(
            id="id2",
            user_id="u2",
            filename="data.json",
            file_size=512,
            file_type="json",
            processing_timestamp=now,
            processing_status=ProcessingStatus.FAILED,
            data_profile={"key": "val"},
            sample_data=[{"a": 1}],
            metadata={"source": "test"},
            created_at=now,
            updated_at=now,
        )
        assert ds.data_profile == {"key": "val"}
        assert ds.sample_data == [{"a": 1}]
        assert ds.metadata == {"source": "test"}


class TestCreateDatasetRequest:
    def test_basic(self):
        req = CreateDatasetRequest(
            filename="data.csv",
            file_size=1000,
            file_type="csv",
            data=[{"a": 1}],
        )
        assert req.metadata is None

    def test_with_metadata(self):
        req = CreateDatasetRequest(
            filename="data.tsv",
            file_size=500,
            file_type="tsv",
            data=[],
            metadata={"tag": "test"},
        )
        assert req.metadata == {"tag": "test"}


class TestCreateDatasetResponse:
    def test_defaults(self):
        resp = CreateDatasetResponse(success=True, dataset_id="ds1")
        assert resp.message == "Dataset created successfully"

    def test_custom_message(self):
        resp = CreateDatasetResponse(success=False, dataset_id="ds2", message="failed")
        assert resp.message == "failed"
