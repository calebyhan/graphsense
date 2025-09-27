"""
Analysis and recommendation related data models
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime
import uuid

from .base import ChartType, AgentType


class AgentReasoning(BaseModel):
    """Reasoning provided by an agent"""
    agent_type: AgentType
    reasoning: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidence: List[str] = []
    processing_time_ms: int = 0

    @validator('confidence')
    def validate_confidence(cls, v):
        return max(0.0, min(1.0, v))


class DataMapping(BaseModel):
    """Data mapping for chart configuration"""
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    facet: Optional[str] = None
    additional_dimensions: Dict[str, str] = {}


class InteractionConfig(BaseModel):
    """Chart interaction configuration"""
    zoom_enabled: bool = True
    pan_enabled: bool = True
    hover_enabled: bool = True
    selection_enabled: bool = False
    brush_enabled: bool = False


class ChartRecommendation(BaseModel):
    """Chart recommendation from agent"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chart_type: ChartType
    confidence: float = Field(..., ge=0.0, le=1.0)
    data_mapping: DataMapping
    reasoning: List[AgentReasoning] = []
    interaction_config: InteractionConfig = Field(default_factory=InteractionConfig)
    styling_suggestions: Dict[str, Any] = {}
    suitability_score: float = Field(..., ge=0.0, le=1.0)


class ComprehensiveDataAnalysis(BaseModel):
    """Complete analysis from Enhanced Data Profiler Agent"""
    dataset_id: str
    statistical_summary: Dict[str, Any]
    correlations: List[Dict[str, Any]] = []
    patterns: Dict[str, Any]
    data_quality: Dict[str, Any]
    temporal_patterns: Optional[Dict[str, Any]] = None
    recommendations_context: Dict[str, Any] = {}
    processing_time_ms: int = 0


class ValidationResult(BaseModel):
    """Validation result for a chart recommendation"""
    chart_type: ChartType
    validation_score: float = Field(..., ge=0.0, le=1.0)
    quality_metrics: Dict[str, Any]
    refinements: Dict[str, Any] = {}
    final_score: float = Field(..., ge=0.0, le=1.0)


class ValidatedRecommendation(BaseModel):
    """Final validated and scored recommendation"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chart_type: ChartType
    confidence: float = Field(..., ge=0.0, le=1.0)
    data_mapping: DataMapping
    reasoning: List[AgentReasoning] = []
    validation_result: ValidationResult
    interaction_config: InteractionConfig
    styling_suggestions: Dict[str, Any] = {}
    final_ranking: int = 1


class AgentAnalysis(BaseModel):
    """Agent analysis database model"""
    id: str
    dataset_id: str
    agent_type: AgentType
    analysis_data: Dict[str, Any]
    confidence_score: Optional[float] = None
    processing_time_ms: Optional[int] = None
    created_at: datetime


class AnalysisRequest(BaseModel):
    """Request for dataset analysis"""
    data: List[Dict[str, Any]]
    filename: Optional[str] = "dataset"
    file_type: Optional[str] = "csv"
    options: Dict[str, Any] = {}


class AnalysisResponse(BaseModel):
    """Response for dataset analysis"""
    success: bool
    dataset_id: str
    recommendations: List[ValidatedRecommendation]
    data_profile: Optional[ComprehensiveDataAnalysis] = None
    processing_time_ms: int
    message: str = "Analysis completed successfully"