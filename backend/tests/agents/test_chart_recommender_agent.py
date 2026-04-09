"""
Unit tests for ChartRecommenderAgent — pure Python logic + mocked AI calls.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.models.processing_context import ProcessingContext
from app.models.base import AgentType, ChartType
from app.models.analysis import ChartRecommendation, DataMapping, AgentReasoning, InteractionConfig
from app.agents.chart_recommender_agent import ChartRecommenderAgent


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def agent():
    return ChartRecommenderAgent()


@pytest.fixture
def ctx_cat_num():
    """Dataset with categorical + numeric columns.
    Uses 15 rows with 3 dept values so the unique ratio (3/15=0.2) < 0.5 → categorical.
    """
    depts = ["Engineering", "Marketing", "Sales"]
    data = [
        {"dept": depts[i % 3], "salary": 50000 + i * 1000, "age": 25 + i}
        for i in range(15)
    ]
    return ProcessingContext.create_from_data("ds-1", data)


@pytest.fixture
def ctx_numeric_only():
    """Dataset with only numeric columns."""
    data = [{"x": i, "y": i * 2, "z": i ** 2} for i in range(10)]
    return ProcessingContext.create_from_data("ds-2", data)


@pytest.fixture
def ctx_temporal():
    """Dataset with a temporal column."""
    import pandas as pd
    ctx = ProcessingContext.create_from_data(
        "ds-3",
        [{"date": f"2021-0{i+1}-01", "value": i * 10, "extra": i * 5} for i in range(5)],
    )
    # Convert date column to datetime
    ctx.sample_data["date"] = pd.to_datetime(ctx.sample_data["date"])
    ctx._column_metadata = None  # reset so metadata is rebuilt
    return ctx


def _make_rec(chart_type=ChartType.BAR, confidence=0.8, x="x", y="y") -> ChartRecommendation:
    return ChartRecommendation(
        chart_type=chart_type,
        confidence=confidence,
        data_mapping=DataMapping(x_axis=x, y_axis=y),
        reasoning=[AgentReasoning(
            agent_type=AgentType.RECOMMENDER,
            reasoning="test",
            confidence=confidence,
        )],
        interaction_config=InteractionConfig(),
        styling_suggestions={"title": "test"},
        suitability_score=confidence,
    )


def _populate_cache(ctx: ProcessingContext, agent: ChartRecommenderAgent):
    """Run profiler-style caching so recommender can use the context."""
    from app.agents.data_profiler_agent import DataProfilerAgent
    profiler = DataProfilerAgent()
    summary = profiler._compute_statistical_summary(ctx.sample_data)
    correlations = profiler._compute_correlations(ctx.sample_data)
    patterns = profiler._compute_patterns(ctx.sample_data)
    ctx.cache_computation("statistical_summary", summary)
    ctx.cache_computation("correlations", correlations)
    ctx.cache_computation("patterns", patterns)


# ── _recommend_for_categorical_numeric ────────────────────────────────────────

def test_recommend_cat_num_no_cols(agent):
    # no categorical cols → empty
    assert agent._recommend_for_categorical_numeric({}, [], ["salary"]) == []
    # no numeric cols → empty
    assert agent._recommend_for_categorical_numeric({}, ["dept"], []) == []


def test_recommend_cat_num_basic(agent, ctx_cat_num):
    _populate_cache(ctx_cat_num, agent)
    summary = ctx_cat_num.get_cached_computation("statistical_summary")
    cols = summary["columns"]
    recs = agent._recommend_for_categorical_numeric(
        cols, ctx_cat_num.get_categorical_columns(), ctx_cat_num.get_numeric_columns()
    )
    assert len(recs) >= 1
    assert recs[0].chart_type == ChartType.BAR


def test_recommend_cat_num_many_categories(agent):
    """unique_count > 20 → bar chart skipped."""
    columns = {"cat": {"unique_count": 25}}
    recs = agent._recommend_for_categorical_numeric(columns, ["cat"], ["val"])
    assert all(r.chart_type != ChartType.BAR for r in recs)


def test_recommend_cat_num_grouped_bar(agent):
    """Multiple numeric columns → grouped bar chart added."""
    columns = {"cat": {"unique_count": 5}}
    recs = agent._recommend_for_categorical_numeric(columns, ["cat"], ["v1", "v2"])
    chart_types = [r.chart_type for r in recs]
    assert chart_types.count(ChartType.BAR) >= 2


# ── _recommend_for_temporal_data ─────────────────────────────────────────────

def test_recommend_temporal_no_cols(agent):
    assert agent._recommend_for_temporal_data({}, [], ["v"]) == []
    assert agent._recommend_for_temporal_data({}, ["date"], []) == []


def test_recommend_temporal_line(agent, ctx_temporal):
    _populate_cache(ctx_temporal, agent)
    recs = agent._recommend_for_temporal_data(
        {}, ctx_temporal.get_temporal_columns(), ctx_temporal.get_numeric_columns()
    )
    assert any(r.chart_type == ChartType.LINE for r in recs)


def test_recommend_temporal_area_multiple_numeric(agent):
    recs = agent._recommend_for_temporal_data({}, ["date"], ["v1", "v2"])
    chart_types = [r.chart_type for r in recs]
    assert ChartType.LINE in chart_types
    assert ChartType.AREA in chart_types


# ── _recommend_for_numeric_relationships ─────────────────────────────────────

def test_recommend_numeric_relationships_single_col(agent):
    assert agent._recommend_for_numeric_relationships({}, ["x"], []) == []


def test_recommend_numeric_with_correlations(agent):
    correlations = [{"column1": "a", "column2": "b", "correlation": 0.8, "strength": "strong"}]
    recs = agent._recommend_for_numeric_relationships({}, ["a", "b"], correlations)
    assert len(recs) == 1
    assert recs[0].chart_type == ChartType.SCATTER
    assert recs[0].confidence >= 0.9


def test_recommend_numeric_weak_correlation(agent):
    correlations = [{"column1": "a", "column2": "b", "correlation": 0.4, "strength": "moderate"}]
    recs = agent._recommend_for_numeric_relationships({}, ["a", "b"], correlations)
    assert recs[0].confidence < 0.9


def test_recommend_numeric_no_correlations(agent):
    recs = agent._recommend_for_numeric_relationships({}, ["a", "b"], [])
    assert recs[0].chart_type == ChartType.SCATTER
    assert recs[0].confidence == 0.6


# ── _recommend_for_distributions ─────────────────────────────────────────────

def test_recommend_distributions_no_numeric(agent):
    assert agent._recommend_for_distributions({}, [], {}) == []


def test_recommend_distributions_basic(agent):
    recs = agent._recommend_for_distributions({}, ["val"], {})
    assert any(r.chart_type == ChartType.HISTOGRAM for r in recs)


def test_recommend_distributions_normal(agent):
    patterns = {"distributions": {"val": {"is_normal": True, "skewness": 0.1}}}
    recs = agent._recommend_for_distributions({}, ["val"], patterns)
    hist = next(r for r in recs if r.chart_type == ChartType.HISTOGRAM)
    assert hist.confidence == 0.85


def test_recommend_distributions_skewed(agent):
    patterns = {"distributions": {"val": {"is_normal": False, "skewness": 2.5}}}
    recs = agent._recommend_for_distributions({}, ["val"], patterns)
    hist = next(r for r in recs if r.chart_type == ChartType.HISTOGRAM)
    assert hist.confidence == 0.9


def test_recommend_distributions_with_outliers(agent):
    patterns = {
        "distributions": {"val": {"is_normal": False, "skewness": 0.1}},
        "outliers": {"val": {"count": 3, "percentage": 5.0}},
    }
    recs = agent._recommend_for_distributions({}, ["val"], patterns)
    chart_types = [r.chart_type for r in recs]
    assert ChartType.BOX_PLOT in chart_types


# ── _recommend_for_categorical_analysis ──────────────────────────────────────

def test_recommend_categorical_no_cols(agent):
    assert agent._recommend_for_categorical_analysis({}, []) == []


def test_recommend_categorical_pie_good_range(agent):
    columns = {"cat": {"unique_count": 5}}
    recs = agent._recommend_for_categorical_analysis(columns, ["cat"])
    assert any(r.chart_type == ChartType.PIE for r in recs)


def test_recommend_categorical_pie_too_many(agent):
    columns = {"cat": {"unique_count": 15}}
    recs = agent._recommend_for_categorical_analysis(columns, ["cat"])
    assert all(r.chart_type != ChartType.PIE for r in recs)


def test_recommend_categorical_pie_too_few(agent):
    columns = {"cat": {"unique_count": 1}}
    recs = agent._recommend_for_categorical_analysis(columns, ["cat"])
    assert all(r.chart_type != ChartType.PIE for r in recs)


# ── _get_interaction_config ───────────────────────────────────────────────────

def test_get_interaction_config_line(agent):
    cfg = agent._get_interaction_config(ChartType.LINE)
    assert cfg.zoom_enabled is True
    assert cfg.pan_enabled is True


def test_get_interaction_config_bar(agent):
    cfg = agent._get_interaction_config(ChartType.BAR)
    assert cfg.zoom_enabled is False


def test_get_interaction_config_default(agent):
    cfg = agent._get_interaction_config(ChartType.PIE)
    assert cfg.hover_enabled is True


# ── _combine_recommendations ─────────────────────────────────────────────────

def test_combine_recommendations_ai_prioritized(agent):
    ai_recs = [_make_rec(ChartType.LINE, 0.7)]
    rule_recs = [_make_rec(ChartType.BAR, 0.8), _make_rec(ChartType.SCATTER, 0.6)]
    combined = agent._combine_recommendations(ai_recs, rule_recs)
    # AI rec should be boosted; BAR (not in AI types) should be added
    chart_types = [r.chart_type for r in combined]
    assert ChartType.LINE in chart_types
    assert ChartType.BAR in chart_types


def test_combine_recommendations_dedup_by_triplet(agent):
    # Two bar charts with different column pairs: only the exact duplicate should be dropped.
    ai_recs = [_make_rec(ChartType.BAR, 0.8, x="dept", y="salary")]
    rule_recs = [
        _make_rec(ChartType.BAR, 0.7, x="dept", y="salary"),   # exact duplicate → dropped
        _make_rec(ChartType.BAR, 0.7, x="dept", y="age"),       # different y_axis → kept
    ]
    combined = agent._combine_recommendations(ai_recs, rule_recs)
    bar_recs = [r for r in combined if r.chart_type == ChartType.BAR]
    # Should have 2: the AI one and the rule one with a different column pair
    assert len(bar_recs) == 2
    y_axes = {r.data_mapping.y_axis for r in bar_recs}
    assert y_axes == {"salary", "age"}


def test_combine_recommendations_no_ai(agent):
    rule_recs = [_make_rec(ChartType.BAR, 0.8)]
    combined = agent._combine_recommendations([], rule_recs)
    assert combined[0].chart_type == ChartType.BAR


def test_combine_recommendations_sorted_by_confidence(agent):
    rule_recs = [_make_rec(ChartType.PIE, 0.5), _make_rec(ChartType.BAR, 0.9)]
    combined = agent._combine_recommendations([], rule_recs)
    assert combined[0].chart_type == ChartType.BAR


# ── _get_ai_recommendations ───────────────────────────────────────────────────

async def test_get_ai_recommendations_success(agent, ctx_cat_num):
    _populate_cache(ctx_cat_num, agent)
    profiler_data = ctx_cat_num.get_cached_computation("statistical_summary")
    mock_service = MagicMock()
    mock_service.generate_chart_recommendations = AsyncMock(return_value=[
        {"chart_type": "bar", "confidence": 0.85, "x_axis": "dept", "y_axis": "salary",
         "reasoning": "good chart", "best_for": ["comparisons"]}
    ])
    with patch("app.agents.chart_recommender_agent.get_gemini_service", return_value=mock_service):
        recs = await agent._get_ai_recommendations(profiler_data, ctx_cat_num, [])
    assert len(recs) == 1
    assert recs[0].chart_type == ChartType.BAR


async def test_get_ai_recommendations_invalid_chart_type_skipped(agent, ctx_cat_num):
    _populate_cache(ctx_cat_num, agent)
    profiler_data = ctx_cat_num.get_cached_computation("statistical_summary")
    mock_service = MagicMock()
    mock_service.generate_chart_recommendations = AsyncMock(return_value=[
        {"chart_type": "invalid_type", "confidence": 0.7}
    ])
    with patch("app.agents.chart_recommender_agent.get_gemini_service", return_value=mock_service):
        recs = await agent._get_ai_recommendations(profiler_data, ctx_cat_num, [])
    assert recs == []


async def test_get_ai_recommendations_failure(agent, ctx_cat_num):
    _populate_cache(ctx_cat_num, agent)
    profiler_data = ctx_cat_num.get_cached_computation("statistical_summary")
    mock_service = MagicMock()
    mock_service.generate_chart_recommendations = AsyncMock(side_effect=Exception("AI down"))
    with patch("app.agents.chart_recommender_agent.get_gemini_service", return_value=mock_service):
        recs = await agent._get_ai_recommendations(profiler_data, ctx_cat_num, [])
    assert recs == []


async def test_get_ai_recommendations_fallback_source_logs_warning(agent, ctx_cat_num):
    """Line 668: when the first rec has _source=='fallback', a warning is logged."""
    _populate_cache(ctx_cat_num, agent)
    profiler_data = ctx_cat_num.get_cached_computation("statistical_summary")
    mock_service = MagicMock()
    # Return a fallback-tagged rec (as returned by gemini_service when AI fails)
    mock_service.generate_chart_recommendations = AsyncMock(return_value=[
        {"_source": "fallback", "chart_type": "bar", "confidence": 0.5,
         "x_axis": "dept", "y_axis": "salary", "reasoning": "fallback", "best_for": []}
    ])
    with patch("app.agents.chart_recommender_agent.get_gemini_service", return_value=mock_service):
        with patch.object(agent, "logger") as mock_logger:
            await agent._get_ai_recommendations(profiler_data, ctx_cat_num, [])
    mock_logger.warning.assert_called_once()
    assert "fallback" in mock_logger.warning.call_args[0][0].lower()


# ── process() ────────────────────────────────────────────────────────────────

async def test_process_success(agent, ctx_cat_num):
    _populate_cache(ctx_cat_num, agent)
    mock_service = MagicMock()
    mock_service.generate_chart_recommendations = AsyncMock(return_value=[])
    with patch("app.agents.chart_recommender_agent.get_gemini_service", return_value=mock_service):
        result = await agent.process(ctx_cat_num)
    assert result.success is True
    assert "recommendations" in result.data


async def test_process_no_profiler_data_returns_error(agent, ctx_cat_num):
    # Don't populate cache → no statistical_summary
    mock_service = MagicMock()
    mock_service.generate_chart_recommendations = AsyncMock(return_value=[])
    with patch("app.agents.chart_recommender_agent.get_gemini_service", return_value=mock_service):
        result = await agent.process(ctx_cat_num)
    assert result.success is False


# ── get_fallback_result ───────────────────────────────────────────────────────

def test_get_fallback_result_cat_num(agent, ctx_cat_num):
    result = agent.get_fallback_result(ctx_cat_num, "error")
    assert result.success is True
    assert result.confidence == 0.3
    recs = result.data["recommendations"]
    assert len(recs) >= 1
    assert recs[0]["chart_type"] == ChartType.BAR


def test_get_fallback_result_temporal(agent, ctx_temporal):
    # Only temporal + numeric → line chart fallback
    # Manually remove categorical cols by clearing metadata
    ctx_temporal._column_metadata = {
        "types": {}, "numeric": ["value"], "categorical": [], "temporal": ["date"], "text": []
    }
    result = agent.get_fallback_result(ctx_temporal, "error")
    assert result.success is True
    recs = result.data["recommendations"]
    assert recs[0]["chart_type"] == ChartType.LINE


def test_get_fallback_result_numeric_only(agent, ctx_numeric_only):
    # Only numeric → scatter fallback
    result = agent.get_fallback_result(ctx_numeric_only, "error")
    assert result.success is True
    recs = result.data["recommendations"]
    assert recs[0]["chart_type"] == ChartType.SCATTER


def test_get_fallback_result_broken_context(agent):
    bad_ctx = MagicMock()
    bad_ctx.get_numeric_columns = MagicMock(side_effect=Exception("broken"))
    result = agent.get_fallback_result(bad_ctx, "error")
    assert result.success is False


# ── _generate_intelligent_recommendations (integration) ─────────────────────

def test_generate_intelligent_recommendations(agent, ctx_cat_num):
    _populate_cache(ctx_cat_num, agent)
    summary = ctx_cat_num.get_cached_computation("statistical_summary")
    correlations = ctx_cat_num.get_cached_computation("correlations")
    patterns = ctx_cat_num.get_cached_computation("patterns")
    recs = agent._generate_intelligent_recommendations(ctx_cat_num, summary, correlations, patterns)
    assert len(recs) <= 5
    assert all(isinstance(r, ChartRecommendation) for r in recs)


# ── _recommend_for_advanced_charts ───────────────────────────────────────────

def test_advanced_charts_no_cols(agent):
    assert agent._recommend_for_advanced_charts({}, [], ["salary"]) == []
    assert agent._recommend_for_advanced_charts({}, ["dept"], []) == []


def test_advanced_charts_single_categorical(agent):
    # Only one categorical column → no heatmap or sankey (requires 2 categoricals)
    columns = {"dept": {"unique_count": 5}}
    recs = agent._recommend_for_advanced_charts(columns, ["dept"], ["salary"])
    chart_types = [r.chart_type for r in recs]
    assert ChartType.HEATMAP not in chart_types
    assert ChartType.SANKEY not in chart_types


def test_advanced_charts_treemap_threshold(agent):
    # cat1_unique <= 10 → no treemap; > 10 → treemap
    columns = {"cat": {"unique_count": 10}}
    recs_no_tree = agent._recommend_for_advanced_charts(columns, ["cat"], ["val"])
    assert all(r.chart_type != ChartType.TREEMAP for r in recs_no_tree)

    columns = {"cat": {"unique_count": 11}}
    recs_with_tree = agent._recommend_for_advanced_charts(columns, ["cat"], ["val"])
    assert any(r.chart_type == ChartType.TREEMAP for r in recs_with_tree)


def test_advanced_charts_heatmap_cardinality_bounds(agent):
    # cat1=5, cat2=5 → heatmap (both in 2..30)
    columns = {"cat1": {"unique_count": 5}, "cat2": {"unique_count": 5}}
    recs = agent._recommend_for_advanced_charts(columns, ["cat1", "cat2"], ["val"])
    assert any(r.chart_type == ChartType.HEATMAP for r in recs)

    # cat1=35 → exceeds heatmap bound → no heatmap
    columns_high = {"cat1": {"unique_count": 35}, "cat2": {"unique_count": 5}}
    recs_high = agent._recommend_for_advanced_charts(columns_high, ["cat1", "cat2"], ["val"])
    assert all(r.chart_type != ChartType.HEATMAP for r in recs_high)


def test_advanced_charts_sankey_threshold(agent):
    # cat1=12, cat2=8 → both within sankey bound (≤15) → sankey produced
    columns = {"cat1": {"unique_count": 12}, "cat2": {"unique_count": 8}}
    recs = agent._recommend_for_advanced_charts(columns, ["cat1", "cat2"], ["val"])
    assert any(r.chart_type == ChartType.SANKEY for r in recs)

    # cat1=16, cat2=8 → cat1 exceeds sankey bound → no sankey
    columns_over = {"cat1": {"unique_count": 16}, "cat2": {"unique_count": 8}}
    recs_over = agent._recommend_for_advanced_charts(columns_over, ["cat1", "cat2"], ["val"])
    assert all(r.chart_type != ChartType.SANKEY for r in recs_over)


def test_advanced_charts_heatmap_color_carries_row_field(agent):
    # The frontend resolves data_mapping.color → rowField for heatmaps.
    # Verify the backend sets color = primary_cat (the row dimension).
    columns = {"cat1": {"unique_count": 5}, "cat2": {"unique_count": 5}}
    recs = agent._recommend_for_advanced_charts(columns, ["cat1", "cat2"], ["val"])
    heatmap = next(r for r in recs if r.chart_type == ChartType.HEATMAP)
    assert heatmap.data_mapping.color == "cat1"   # primary_cat → rowField via frontend


def test_advanced_charts_sankey_color_carries_target(agent):
    # The frontend resolves data_mapping.color → target for sankeys.
    columns = {"cat1": {"unique_count": 5}, "cat2": {"unique_count": 5}}
    recs = agent._recommend_for_advanced_charts(columns, ["cat1", "cat2"], ["val"])
    sankey = next(r for r in recs if r.chart_type == ChartType.SANKEY)
    assert sankey.data_mapping.color == "cat2"    # cat2 → target via frontend
