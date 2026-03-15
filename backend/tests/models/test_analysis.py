"""
Unit tests for app/models/analysis.py — 100% coverage.
"""

from datetime import datetime
import uuid
import pytest
from pydantic import ValidationError
from app.models.analysis import (
    AgentReasoning,
    DataMapping,
    InteractionConfig,
    ChartRecommendation,
    ComprehensiveDataAnalysis,
    ValidationResult,
    ValidatedRecommendation,
    AgentAnalysis,
    AnalysisRequest,
    AnalysisResponse,
)
from app.models.base import AgentType, ChartType


class TestAgentReasoning:
    def test_basic(self):
        r = AgentReasoning(
            agent_type=AgentType.PROFILER,
            reasoning="looks good",
            confidence=0.8,
        )
        assert r.confidence == 0.8
        assert r.evidence == []
        assert r.processing_time_ms == 0

    def test_out_of_range_above_raises(self):
        with pytest.raises(ValidationError):
            AgentReasoning(agent_type=AgentType.PROFILER, reasoning="x", confidence=1.5)

    def test_out_of_range_below_raises(self):
        with pytest.raises(ValidationError):
            AgentReasoning(agent_type=AgentType.PROFILER, reasoning="x", confidence=-0.5)

    def test_boundary_values_accepted(self):
        r_low = AgentReasoning(agent_type=AgentType.PROFILER, reasoning="x", confidence=0.0)
        r_high = AgentReasoning(agent_type=AgentType.PROFILER, reasoning="x", confidence=1.0)
        assert r_low.confidence == 0.0
        assert r_high.confidence == 1.0

    def test_with_evidence(self):
        r = AgentReasoning(
            agent_type=AgentType.RECOMMENDER,
            reasoning="reason",
            confidence=0.5,
            evidence=["a", "b"],
            processing_time_ms=100,
        )
        assert len(r.evidence) == 2
        assert r.processing_time_ms == 100


class TestDataMapping:
    def test_all_defaults_none(self):
        dm = DataMapping()
        assert dm.x_axis is None
        assert dm.y_axis is None
        assert dm.color is None
        assert dm.size is None
        assert dm.facet is None
        assert dm.additional_dimensions == {}

    def test_with_values(self):
        dm = DataMapping(x_axis="date", y_axis="sales", color="region")
        assert dm.x_axis == "date"
        assert dm.y_axis == "sales"
        assert dm.color == "region"


class TestInteractionConfig:
    def test_defaults(self):
        ic = InteractionConfig()
        assert ic.zoom_enabled is True
        assert ic.pan_enabled is True
        assert ic.hover_enabled is True
        assert ic.selection_enabled is False
        assert ic.brush_enabled is False

    def test_override(self):
        ic = InteractionConfig(selection_enabled=True, brush_enabled=True, zoom_enabled=False)
        assert ic.selection_enabled is True
        assert ic.zoom_enabled is False


class TestChartRecommendation:
    def _base(self):
        return ChartRecommendation(
            chart_type=ChartType.BAR,
            confidence=0.9,
            data_mapping=DataMapping(x_axis="cat", y_axis="val"),
            suitability_score=0.85,
        )

    def test_id_generated(self):
        r = self._base()
        assert uuid.UUID(r.id).version == 4

    def test_defaults(self):
        r = self._base()
        assert r.reasoning == []
        assert isinstance(r.interaction_config, InteractionConfig)
        assert r.styling_suggestions == {}

    def test_with_reasoning(self):
        reasoning = [AgentReasoning(agent_type=AgentType.PROFILER, reasoning="ok", confidence=0.7)]
        r = ChartRecommendation(
            chart_type=ChartType.LINE,
            confidence=0.6,
            data_mapping=DataMapping(),
            suitability_score=0.6,
            reasoning=reasoning,
        )
        assert len(r.reasoning) == 1


class TestComprehensiveDataAnalysis:
    def test_basic(self):
        a = ComprehensiveDataAnalysis(
            dataset_id="ds1",
            statistical_summary={"mean": 5.0},
            patterns={"trend": "up"},
            data_quality={"missing": 0},
        )
        assert a.dataset_id == "ds1"
        assert a.correlations == []
        assert a.temporal_patterns is None
        assert a.recommendations_context == {}
        assert a.processing_time_ms == 0


class TestValidationResult:
    def test_basic(self):
        vr = ValidationResult(
            chart_type=ChartType.SCATTER,
            validation_score=0.9,
            quality_metrics={"completeness": 1.0},
            final_score=0.88,
        )
        assert vr.refinements == {}
        assert vr.chart_type == ChartType.SCATTER


class TestValidatedRecommendation:
    def _make(self):
        vr = ValidationResult(
            chart_type=ChartType.BAR,
            validation_score=0.9,
            quality_metrics={},
            final_score=0.9,
        )
        return ValidatedRecommendation(
            chart_type=ChartType.BAR,
            confidence=0.9,
            data_mapping=DataMapping(),
            validation_result=vr,
            interaction_config=InteractionConfig(),
        )

    def test_id_generated(self):
        r = self._make()
        assert uuid.UUID(r.id).version == 4

    def test_defaults(self):
        r = self._make()
        assert r.reasoning == []
        assert r.styling_suggestions == {}
        assert r.final_ranking == 1


class TestAgentAnalysis:
    def test_basic(self):
        aa = AgentAnalysis(
            id="id1",
            dataset_id="ds1",
            agent_type=AgentType.VALIDATOR,
            analysis_data={"key": "val"},
            created_at=datetime.now(),
        )
        assert aa.confidence_score is None
        assert aa.processing_time_ms is None

    def test_with_optional_fields(self):
        aa = AgentAnalysis(
            id="id2",
            dataset_id="ds2",
            agent_type=AgentType.RECOMMENDER,
            analysis_data={},
            confidence_score=0.75,
            processing_time_ms=200,
            created_at=datetime.now(),
        )
        assert aa.confidence_score == 0.75
        assert aa.processing_time_ms == 200


class TestAnalysisRequest:
    def test_defaults(self):
        req = AnalysisRequest(data=[{"a": 1}])
        assert req.filename == "dataset"
        assert req.file_type == "csv"
        assert req.options == {}

    def test_custom(self):
        req = AnalysisRequest(data=[], filename="test.json", file_type="json", options={"x": 1})
        assert req.filename == "test.json"
        assert req.options == {"x": 1}


class TestAnalysisResponse:
    def test_basic(self):
        resp = AnalysisResponse(
            success=True,
            dataset_id="ds1",
            recommendations=[],
            processing_time_ms=500,
        )
        assert resp.message == "Analysis completed successfully"
        assert resp.data_profile is None

    def test_with_profile(self):
        profile = ComprehensiveDataAnalysis(
            dataset_id="ds1",
            statistical_summary={},
            patterns={},
            data_quality={},
        )
        resp = AnalysisResponse(
            success=True,
            dataset_id="ds1",
            recommendations=[],
            processing_time_ms=100,
            data_profile=profile,
        )
        assert resp.data_profile is not None
