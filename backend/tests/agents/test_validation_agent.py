"""
Unit tests for ValidationAgent — pure Python logic + mocked AI calls.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.models.processing_context import ProcessingContext
from app.models.base import AgentType, ChartType
from app.models.analysis import (
    ChartRecommendation,
    DataMapping,
    AgentReasoning,
    InteractionConfig,
    ValidatedRecommendation,
    ValidationResult,
)
from app.agents.validation_agent import ValidationAgent


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_rec(chart_type=ChartType.BAR, confidence=0.8, x="x", y="y") -> ChartRecommendation:
    return ChartRecommendation(
        chart_type=chart_type,
        confidence=confidence,
        data_mapping=DataMapping(x_axis=x, y_axis=y),
        reasoning=[AgentReasoning(
            agent_type=AgentType.RECOMMENDER,
            reasoning="test reasoning",
            confidence=confidence,
        )],
        interaction_config=InteractionConfig(),
        styling_suggestions={"title": "Test"},
        suitability_score=confidence,
    )


def _make_context_with_recs(*recs: ChartRecommendation) -> ProcessingContext:
    ctx = ProcessingContext.create_from_data("ds-1", [{"a": 1, "b": 2}, {"a": 3, "b": 4}])
    ctx.cache_computation("recommendations", [r.model_dump() for r in recs])
    ctx.cache_computation("statistical_summary", {"row_count": 2, "column_count": 2, "columns": {}})
    ctx.cache_computation("correlations", [])
    ctx.cache_computation("patterns", {})
    return ctx


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def agent():
    return ValidationAgent()


@pytest.fixture
def ctx_with_recs():
    rec = _make_rec(ChartType.BAR, 0.8)
    return _make_context_with_recs(rec)


# ── _parse_recommendations ────────────────────────────────────────────────────

def test_parse_recommendations_valid(agent):
    rec = _make_rec()
    parsed = agent._parse_recommendations([rec.model_dump()])
    assert len(parsed) == 1
    assert isinstance(parsed[0], ChartRecommendation)


def test_parse_recommendations_invalid_entry_skipped(agent):
    parsed = agent._parse_recommendations([{"completely": "broken"}])
    assert parsed == []


def test_parse_recommendations_mixed(agent):
    valid = _make_rec().model_dump()
    parsed = agent._parse_recommendations([valid, {"bad": "entry"}])
    assert len(parsed) == 1


# ── _validate_recommendation ─────────────────────────────────────────────────

def test_validate_recommendation_default_scores(agent, ctx_with_recs):
    rec = _make_rec(ChartType.LINE, 0.9)
    ctx = _make_context_with_recs(rec)
    validated = agent._validate_recommendation(
        rec, ctx,
        ctx.get_cached_computation("statistical_summary"),
        ctx.get_cached_computation("correlations"),
        ctx.get_cached_computation("patterns"),
        ai_validation=None
    )
    assert isinstance(validated, ValidatedRecommendation)
    assert validated.chart_type == ChartType.LINE
    assert 0.0 <= validated.validation_result.final_score <= 1.0


def test_validate_recommendation_with_ai_scores(agent, ctx_with_recs):
    rec = _make_rec()
    ctx = _make_context_with_recs(rec)
    ai_validation = {
        "scores": {
            "data_appropriateness": 0.95,
            "visual_clarity": 0.85,
            "accessibility": 0.75,
        }
    }
    validated = agent._validate_recommendation(
        rec, ctx,
        ctx.get_cached_computation("statistical_summary"),
        [],
        {},
        ai_validation=ai_validation
    )
    assert validated.validation_result.quality_metrics["data_appropriateness"] == 0.95
    assert validated.validation_result.quality_metrics["visual_clarity"] == 0.85


def test_validate_recommendation_final_score_in_range(agent, ctx_with_recs):
    rec = _make_rec(confidence=0.7)
    ctx = _make_context_with_recs(rec)
    validated = agent._validate_recommendation(rec, ctx, {}, [], {})
    score = validated.validation_result.final_score
    assert 0.0 <= score <= 1.0


def test_validate_recommendation_reasoning_combined(agent, ctx_with_recs):
    rec = _make_rec()
    ctx = _make_context_with_recs(rec)
    validated = agent._validate_recommendation(rec, ctx, {}, [], {})
    # Should have original reasoning + validator reasoning
    assert len(validated.reasoning) == 2
    assert any(r.agent_type == AgentType.VALIDATOR for r in validated.reasoning)


# ── _get_ai_validations ───────────────────────────────────────────────────────

async def test_get_ai_validations_success(agent):
    mock_service = MagicMock()
    mock_service.validate_chart_recommendations = AsyncMock(
        return_value=[{"scores": {"data_appropriateness": 0.9}}]
    )
    with patch("app.agents.validation_agent.get_gemini_service", return_value=mock_service):
        result = await agent._get_ai_validations([{"chart_type": "bar"}], {})
    assert len(result) == 1
    assert result[0]["scores"]["data_appropriateness"] == 0.9


async def test_get_ai_validations_failure(agent):
    mock_service = MagicMock()
    mock_service.validate_chart_recommendations = AsyncMock(side_effect=Exception("AI down"))
    with patch("app.agents.validation_agent.get_gemini_service", return_value=mock_service):
        result = await agent._get_ai_validations([], {})
    assert result == []


# ── process() ────────────────────────────────────────────────────────────────

async def test_process_success(agent, ctx_with_recs):
    mock_service = MagicMock()
    mock_service.validate_chart_recommendations = AsyncMock(return_value=[])
    with patch("app.agents.validation_agent.get_gemini_service", return_value=mock_service):
        result = await agent.process(ctx_with_recs)
    assert result.success is True
    assert "validated_recommendations" in result.data
    recs = result.data["validated_recommendations"]
    assert len(recs) == 1
    # Rankings are assigned after sorting
    assert recs[0]["final_ranking"] == 1


async def test_process_multiple_recommendations_sorted(agent):
    recs = [
        _make_rec(ChartType.BAR, 0.5),
        _make_rec(ChartType.LINE, 0.9),
        _make_rec(ChartType.SCATTER, 0.7),
    ]
    ctx = _make_context_with_recs(*recs)
    mock_service = MagicMock()
    mock_service.validate_chart_recommendations = AsyncMock(return_value=[])
    with patch("app.agents.validation_agent.get_gemini_service", return_value=mock_service):
        result = await agent.process(ctx)
    assert result.success is True
    validated = result.data["validated_recommendations"]
    scores = [v["validation_result"]["final_score"] for v in validated]
    assert scores == sorted(scores, reverse=True)


async def test_process_no_recommendations_returns_error(agent):
    ctx = ProcessingContext.create_from_data("ds-1", [{"a": 1}])
    # No "recommendations" cached
    mock_service = MagicMock()
    mock_service.validate_chart_recommendations = AsyncMock(return_value=[])
    with patch("app.agents.validation_agent.get_gemini_service", return_value=mock_service):
        result = await agent.process(ctx)
    assert result.success is False


async def test_process_empty_recommendations_list_returns_error(agent):
    ctx = ProcessingContext.create_from_data("ds-1", [{"a": 1}])
    ctx.cache_computation("recommendations", [])
    mock_service = MagicMock()
    mock_service.validate_chart_recommendations = AsyncMock(return_value=[])
    with patch("app.agents.validation_agent.get_gemini_service", return_value=mock_service):
        result = await agent.process(ctx)
    assert result.success is False


async def test_process_all_recs_unparseable_returns_error(agent):
    """All recommendation entries fail to parse → empty list → raises ValueError (line 65)."""
    ctx = ProcessingContext.create_from_data("ds-1", [{"a": 1}])
    ctx.cache_computation("recommendations", [{"chart_type": "totally_invalid_type"}])
    mock_service = MagicMock()
    mock_service.validate_chart_recommendations = AsyncMock(return_value=[])
    with patch("app.agents.validation_agent.get_gemini_service", return_value=mock_service):
        result = await agent.process(ctx)
    assert result.success is False


async def test_process_with_ai_validation_scores(agent):
    rec = _make_rec(ChartType.BAR, 0.8)
    ctx = _make_context_with_recs(rec)
    ai_validations = [{"scores": {"data_appropriateness": 0.95, "visual_clarity": 0.9, "accessibility": 0.8}}]
    mock_service = MagicMock()
    mock_service.validate_chart_recommendations = AsyncMock(return_value=ai_validations)
    with patch("app.agents.validation_agent.get_gemini_service", return_value=mock_service):
        result = await agent.process(ctx)
    assert result.success is True


# ── get_fallback_result ───────────────────────────────────────────────────────

def test_get_fallback_result_with_recommendations(agent):
    rec = _make_rec()
    ctx = _make_context_with_recs(rec)
    result = agent.get_fallback_result(ctx, "error")
    assert result.success is True
    assert result.confidence == 0.3
    validated = result.data["validated_recommendations"]
    assert len(validated) == 1


def test_get_fallback_result_limits_to_three(agent):
    recs = [_make_rec(confidence=0.7) for _ in range(5)]
    ctx = _make_context_with_recs(*recs)
    result = agent.get_fallback_result(ctx, "error")
    assert len(result.data["validated_recommendations"]) <= 3


def test_get_fallback_result_no_recommendations(agent):
    ctx = ProcessingContext.create_from_data("ds-1", [{"a": 1}])
    # No recs cached
    result = agent.get_fallback_result(ctx, "error")
    assert result.success is True
    assert result.data["validated_recommendations"] == []


def test_get_fallback_result_broken_context(agent):
    bad_ctx = MagicMock()
    bad_ctx.get_cached_computation = MagicMock(side_effect=Exception("broken"))
    result = agent.get_fallback_result(bad_ctx, "error")
    assert result.success is False


def test_get_fallback_result_invalid_rec_data_skipped(agent):
    """Invalid chart_type causes ChartType() to raise → entry skipped."""
    ctx = ProcessingContext.create_from_data("ds-1", [{"a": 1}])
    ctx.cache_computation("recommendations", [{"chart_type": "not_a_real_type"}])
    result = agent.get_fallback_result(ctx, "error")
    assert result.success is True
    assert result.data["validated_recommendations"] == []
