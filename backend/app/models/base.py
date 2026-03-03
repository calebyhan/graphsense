"""
Base models and common types for the GraphSense
"""

from enum import Enum
from typing import Dict, List, Any, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


class DataType(str, Enum):
    """Data type enumeration"""
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"
    TEMPORAL = "temporal"
    TEXT = "text"
    BOOLEAN = "boolean"


class ChartType(str, Enum):
    """Supported chart types"""
    BAR = "bar"
    COLUMN = "column"
    LINE = "line"
    SCATTER = "scatter"
    PIE = "pie"
    HISTOGRAM = "histogram"
    BOX_PLOT = "box_plot"
    HEATMAP = "heatmap"
    AREA = "area"
    TREEMAP = "treemap"
    SANKEY = "sankey"


class ProcessingStatus(str, Enum):
    """Dataset processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentType(str, Enum):
    """Agent types in the pipeline"""
    PROFILER = "profiler"
    RECOMMENDER = "recommender"
    VALIDATOR = "validator"


class BaseResponse(BaseModel):
    """Base response model"""
    success: bool
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorResponse(BaseResponse):
    """Error response model"""
    success: bool = False
    error: str
    details: Optional[str] = None
    error_code: Optional[str] = None