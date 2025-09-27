"""
Dataset related data models
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime
import uuid

from .base import DataType, ProcessingStatus


class ColumnProfile(BaseModel):
    """Profile information for a single column"""
    name: str
    data_type: DataType
    null_count: int = 0
    null_percentage: float = 0.0
    unique_count: int = 0
    unique_percentage: float = 0.0
    sample_values: List[Any] = []
    distribution_summary: Dict[str, Any] = {}

    @validator('null_percentage', 'unique_percentage')
    def validate_percentage(cls, v):
        return max(0.0, min(100.0, v))


class DataQualityIssue(BaseModel):
    """Data quality issue information"""
    column: str
    issue_type: str
    severity: str  # 'low', 'medium', 'high'
    description: str
    suggestion: Optional[str] = None


class ProcessedDataset(BaseModel):
    """Processed dataset from client"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    file_size: int
    file_type: str
    columns: Dict[str, DataType]
    row_count: int
    sample_data: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {}

    @validator('file_type')
    def validate_file_type(cls, v):
        allowed_types = ['csv', 'json', 'xlsx', 'xls', 'tsv']
        if v.lower() not in allowed_types:
            raise ValueError(f"Unsupported file type: {v}")
        return v.lower()


class DataProfile(BaseModel):
    """Complete data profile for a dataset"""
    dataset_id: str
    column_profiles: Dict[str, ColumnProfile]
    correlations: Dict[str, float] = {}
    data_quality_issues: List[DataQualityIssue] = []
    statistical_summary: Dict[str, Any] = {}
    processing_time_ms: int = 0


class Dataset(BaseModel):
    """Dataset database model"""
    id: str
    user_id: str
    filename: str
    file_size: int
    file_type: str
    processing_timestamp: datetime
    processing_status: ProcessingStatus
    data_profile: Optional[Dict[str, Any]] = None
    sample_data: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class CreateDatasetRequest(BaseModel):
    """Request to create a new dataset"""
    filename: str
    file_size: int
    file_type: str
    data: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None


class CreateDatasetResponse(BaseModel):
    """Response for dataset creation"""
    success: bool
    dataset_id: str
    message: str = "Dataset created successfully"