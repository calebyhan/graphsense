"""
Unit tests for PipelineOrchestrator.
All agents, Supabase, and ProcessingContext are mocked.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.agents.base_agent import AgentResult
from app.models.base import AgentType
from app.services.pipeline_orchestrator import (
    PipelineOrchestrator,
    PipelineProgress,
    PipelineStatus,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_agent_result(success=True, data=None, agent_type=AgentType.PROFILER):
    return AgentResult(
        agent_type=agent_type,
        success=success,
        data=data or {},
        processing_time_ms=10,
        confidence=0.9,
        error_message=None if success else "error",
    )


def _make_supabase():
    sb = MagicMock()
    tbl = MagicMock()
    tbl.select.return_value = tbl
    tbl.insert.return_value = tbl
    tbl.update.return_value = tbl
    tbl.eq.return_value = tbl
    tbl.order.return_value = tbl
    tbl.execute.return_value = MagicMock(data=[])
    sb.table.return_value = tbl
    return sb


@pytest.fixture
def mock_supabase():
    return _make_supabase()


@pytest.fixture
def orch(mock_supabase):
    with patch("app.services.pipeline_orchestrator.DataProfilerAgent"), \
         patch("app.services.pipeline_orchestrator.ChartRecommenderAgent"), \
         patch("app.services.pipeline_orchestrator.ValidationAgent"), \
         patch("app.services.pipeline_orchestrator.get_supabase_client", return_value=mock_supabase):
        o = PipelineOrchestrator()
        o.supabase = mock_supabase
        o.profiler_agent = MagicMock()
        o.recommender_agent = MagicMock()
        o.validation_agent = MagicMock()
        # Patch helpers so tests focus on the method under test
        o._update_dataset_status = AsyncMock()
        o._store_agent_analysis = AsyncMock()
        return o


# ---------------------------------------------------------------------------
# PipelineStatus
# ---------------------------------------------------------------------------

def test_pipeline_status_values():
    assert PipelineStatus.PENDING.value == "pending"
    assert PipelineStatus.PROCESSING.value == "processing"
    assert PipelineStatus.COMPLETED.value == "completed"
    assert PipelineStatus.FAILED.value == "failed"
    assert PipelineStatus.CANCELLED.value == "cancelled"


# ---------------------------------------------------------------------------
# PipelineProgress
# ---------------------------------------------------------------------------

def test_pipeline_progress_defaults():
    p = PipelineProgress(dataset_id="d1", status=PipelineStatus.PENDING)
    assert p.completed_agents == []
    assert p.progress_percentage == 0
    assert p.current_agent is None


def test_pipeline_progress_preserves_provided_completed_agents():
    p = PipelineProgress(dataset_id="d1", status=PipelineStatus.PROCESSING, completed_agents=["profiler"])
    assert p.completed_agents == ["profiler"]


# ---------------------------------------------------------------------------
# PipelineOrchestrator.__init__
# ---------------------------------------------------------------------------

def test_orchestrator_init(mock_supabase):
    with patch("app.services.pipeline_orchestrator.DataProfilerAgent") as P, \
         patch("app.services.pipeline_orchestrator.ChartRecommenderAgent") as R, \
         patch("app.services.pipeline_orchestrator.ValidationAgent") as V, \
         patch("app.services.pipeline_orchestrator.get_supabase_client", return_value=mock_supabase):
        o = PipelineOrchestrator()
    P.assert_called_once()
    R.assert_called_once()
    V.assert_called_once()
    assert o.supabase is mock_supabase


# ---------------------------------------------------------------------------
# analyze_dataset — success
# ---------------------------------------------------------------------------

async def test_analyze_dataset_success_no_callback(orch):
    profiler_data = {
        "dataset_id": "ds1",
        "statistical_summary": {},
        "patterns": {},
        "data_quality": {},
        "processing_time_ms": 10,
    }

    orch.profiler_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(data=profiler_data)
    )
    orch.recommender_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(agent_type=AgentType.RECOMMENDER, data={"recommendations": []})
    )
    orch.validation_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(agent_type=AgentType.VALIDATOR, data={"validated_recommendations": []})
    )

    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_ctx.sample_data = MagicMock(__len__=lambda self: 5)
    mock_response = MagicMock(success=True, dataset_id="ds1")

    with patch("app.services.pipeline_orchestrator.ProcessingContext") as MockCtx, \
         patch("app.services.pipeline_orchestrator.ComprehensiveDataAnalysis"), \
         patch("app.services.pipeline_orchestrator.AnalysisResponse", return_value=mock_response):
        MockCtx.create_from_data.return_value = mock_ctx

        result = await orch.analyze_dataset([{"a": 1}], "ds1")

    assert result.success is True
    assert result.dataset_id == "ds1"
    orch._update_dataset_status.assert_any_await("ds1", "processing")
    orch._update_dataset_status.assert_any_await("ds1", "completed")


async def test_analyze_dataset_calls_progress_callback(orch):
    profiler_data = {
        "dataset_id": "ds1",
        "statistical_summary": {},
        "patterns": {},
        "data_quality": {},
        "processing_time_ms": 10,
    }

    orch.profiler_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(data=profiler_data)
    )
    orch.recommender_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(agent_type=AgentType.RECOMMENDER, data={"recommendations": []})
    )
    orch.validation_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(agent_type=AgentType.VALIDATOR, data={"validated_recommendations": []})
    )

    callback = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_ctx.sample_data = MagicMock(__len__=lambda self: 5)
    mock_response = MagicMock(success=True, dataset_id="ds1")

    with patch("app.services.pipeline_orchestrator.ProcessingContext") as MockCtx, \
         patch("app.services.pipeline_orchestrator.ComprehensiveDataAnalysis"), \
         patch("app.services.pipeline_orchestrator.AnalysisResponse", return_value=mock_response):
        MockCtx.create_from_data.return_value = mock_ctx
        await orch.analyze_dataset([{"a": 1}], "ds1", progress_callback=callback)

    assert callback.call_count >= 2


async def test_analyze_dataset_exception_returns_error_response(orch):
    orch.profiler_agent._safe_process = AsyncMock(side_effect=RuntimeError("crash"))

    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_ctx.sample_data = MagicMock(__len__=lambda self: 5)

    with patch("app.services.pipeline_orchestrator.ProcessingContext") as MockCtx:
        MockCtx.create_from_data.return_value = mock_ctx
        result = await orch.analyze_dataset([{"a": 1}], "ds1")

    assert result.success is False
    orch._update_dataset_status.assert_any_await("ds1", "failed")


async def test_analyze_dataset_exception_with_progress_callback(orch):
    orch.profiler_agent._safe_process = AsyncMock(side_effect=RuntimeError("crash"))
    callback = MagicMock()

    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_ctx.sample_data = MagicMock(__len__=lambda self: 5)

    with patch("app.services.pipeline_orchestrator.ProcessingContext") as MockCtx:
        MockCtx.create_from_data.return_value = mock_ctx
        result = await orch.analyze_dataset([{"a": 1}], "ds1", progress_callback=callback)

    assert result.success is False
    # Callback must be called with failed status
    last_call = callback.call_args_list[-1][0][0]
    assert last_call.status == PipelineStatus.FAILED


async def test_analyze_dataset_validated_recs_conversion(orch):
    """Ensure ValidatedRecommendation objects are created from result data."""
    profiler_data = {
        "dataset_id": "ds1",
        "statistical_summary": {},
        "patterns": {},
        "data_quality": {},
        "processing_time_ms": 10,
    }
    validated_rec = {
        "chart_type": "bar",
        "confidence": 0.8,
        "data_mapping": {},
        "validation_result": {"chart_type": "bar", "validation_score": 0.8, "quality_metrics": {}, "final_score": 0.8},
        "interaction_config": {},
        "styling_suggestions": {},
        "final_ranking": 1,
    }

    orch.profiler_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(data=profiler_data)
    )
    orch.recommender_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(agent_type=AgentType.RECOMMENDER, data={"recommendations": []})
    )
    orch.validation_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(
            agent_type=AgentType.VALIDATOR,
            data={"validated_recommendations": [validated_rec]}
        )
    )

    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_ctx.sample_data = MagicMock(__len__=lambda self: 5)
    mock_response = MagicMock(success=True, dataset_id="ds1")

    with patch("app.services.pipeline_orchestrator.ProcessingContext") as MockCtx, \
         patch("app.services.pipeline_orchestrator.ComprehensiveDataAnalysis"), \
         patch("app.services.pipeline_orchestrator.ValidatedRecommendation") as MockVR, \
         patch("app.services.pipeline_orchestrator.AnalysisResponse", return_value=mock_response):
        MockCtx.create_from_data.return_value = mock_ctx
        MockVR.return_value = MagicMock()
        result = await orch.analyze_dataset([{"a": 1}], "ds1")

    MockVR.assert_called_once_with(**validated_rec)
    assert result.success is True


async def test_analyze_dataset_profiler_data_creation_error(orch):
    """ComprehensiveDataAnalysis construction failure is handled gracefully."""
    profiler_data = {"bad": "data"}

    orch.profiler_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(data=profiler_data)
    )
    orch.recommender_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(agent_type=AgentType.RECOMMENDER, data={"recommendations": []})
    )
    orch.validation_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(agent_type=AgentType.VALIDATOR, data={"validated_recommendations": []})
    )

    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_ctx.sample_data = MagicMock(__len__=lambda self: 5)
    mock_response = MagicMock(success=True, dataset_id="ds1", data_profile=None)

    with patch("app.services.pipeline_orchestrator.ProcessingContext") as MockCtx, \
         patch("app.services.pipeline_orchestrator.ComprehensiveDataAnalysis", side_effect=Exception("bad")), \
         patch("app.services.pipeline_orchestrator.AnalysisResponse", return_value=mock_response):
        MockCtx.create_from_data.return_value = mock_ctx
        result = await orch.analyze_dataset([{"a": 1}], "ds1")

    assert result.success is True
    assert result.data_profile is None


# ---------------------------------------------------------------------------
# _execute_profiler_stage
# ---------------------------------------------------------------------------

async def test_execute_profiler_stage_success(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_result = _make_agent_result()
    orch.profiler_agent._safe_process = AsyncMock(return_value=mock_result)
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    result = await orch._execute_profiler_stage(mock_ctx, progress)
    assert result is mock_result
    assert "profiler" in progress.completed_agents


async def test_execute_profiler_stage_failure_result(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_result = _make_agent_result(success=False)
    orch.profiler_agent._safe_process = AsyncMock(return_value=mock_result)
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    result = await orch._execute_profiler_stage(mock_ctx, progress)
    assert result is mock_result
    assert "profiler" not in progress.completed_agents


async def test_execute_profiler_stage_timeout(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    orch.profiler_agent._safe_process = AsyncMock(side_effect=asyncio.TimeoutError())
    orch.agent_timeout_seconds = 0.001
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    with pytest.raises(Exception, match="timed out"):
        await orch._execute_profiler_stage(mock_ctx, progress)


async def test_execute_profiler_stage_exception(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    orch.profiler_agent._safe_process = AsyncMock(side_effect=RuntimeError("profiler error"))
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    with pytest.raises(RuntimeError, match="profiler error"):
        await orch._execute_profiler_stage(mock_ctx, progress)


async def test_execute_profiler_stage_with_callback(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    orch.profiler_agent._safe_process = AsyncMock(return_value=_make_agent_result())
    callback = MagicMock()
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    await orch._execute_profiler_stage(mock_ctx, progress, progress_callback=callback)
    assert callback.call_count >= 1


# ---------------------------------------------------------------------------
# _execute_recommender_stage
# ---------------------------------------------------------------------------

async def test_execute_recommender_stage_success(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_result = _make_agent_result(
        agent_type=AgentType.RECOMMENDER,
        data={"recommendations": [{"chart_type": "bar"}]}
    )
    orch.recommender_agent._safe_process = AsyncMock(return_value=mock_result)
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    result = await orch._execute_recommender_stage(mock_ctx, progress)
    assert "recommender" in progress.completed_agents
    mock_ctx.cache_computation.assert_called_with("recommendations", [{"chart_type": "bar"}])


async def test_execute_recommender_stage_failure_result(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_result = _make_agent_result(agent_type=AgentType.RECOMMENDER, success=False)
    orch.recommender_agent._safe_process = AsyncMock(return_value=mock_result)
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    result = await orch._execute_recommender_stage(mock_ctx, progress)
    assert "recommender" not in progress.completed_agents


async def test_execute_recommender_stage_timeout(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    orch.recommender_agent._safe_process = AsyncMock(side_effect=asyncio.TimeoutError())
    orch.agent_timeout_seconds = 0.001
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    with pytest.raises(Exception, match="timed out"):
        await orch._execute_recommender_stage(mock_ctx, progress)


async def test_execute_recommender_stage_exception(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    orch.recommender_agent._safe_process = AsyncMock(side_effect=RuntimeError("rec error"))
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    with pytest.raises(RuntimeError, match="rec error"):
        await orch._execute_recommender_stage(mock_ctx, progress)


async def test_execute_recommender_stage_with_callback(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    orch.recommender_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(agent_type=AgentType.RECOMMENDER, data={"recommendations": []})
    )
    callback = MagicMock()
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    await orch._execute_recommender_stage(mock_ctx, progress, progress_callback=callback)
    assert callback.call_count >= 1


# ---------------------------------------------------------------------------
# _execute_validation_stage
# ---------------------------------------------------------------------------

async def test_execute_validation_stage_success(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_result = _make_agent_result(
        agent_type=AgentType.VALIDATOR,
        data={"validated_recommendations": [{"chart_type": "bar"}]}
    )
    orch.validation_agent._safe_process = AsyncMock(return_value=mock_result)
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    result = await orch._execute_validation_stage(mock_ctx, progress)
    assert "validator" in progress.completed_agents


async def test_execute_validation_stage_failure_result(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_result = _make_agent_result(agent_type=AgentType.VALIDATOR, success=False)
    orch.validation_agent._safe_process = AsyncMock(return_value=mock_result)
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    result = await orch._execute_validation_stage(mock_ctx, progress)
    assert "validator" not in progress.completed_agents


async def test_execute_validation_stage_timeout(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    orch.validation_agent._safe_process = AsyncMock(side_effect=asyncio.TimeoutError())
    orch.agent_timeout_seconds = 0.001
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    with pytest.raises(Exception, match="timed out"):
        await orch._execute_validation_stage(mock_ctx, progress)


async def test_execute_validation_stage_exception(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    orch.validation_agent._safe_process = AsyncMock(side_effect=RuntimeError("val error"))
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    with pytest.raises(RuntimeError, match="val error"):
        await orch._execute_validation_stage(mock_ctx, progress)


async def test_execute_validation_stage_with_callback(orch):
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    orch.validation_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(agent_type=AgentType.VALIDATOR, data={"validated_recommendations": []})
    )
    callback = MagicMock()
    progress = PipelineProgress(dataset_id="ds1", status=PipelineStatus.PROCESSING)

    await orch._execute_validation_stage(mock_ctx, progress, progress_callback=callback)
    assert callback.call_count >= 1


# ---------------------------------------------------------------------------
# get_status
# ---------------------------------------------------------------------------

async def test_get_status_not_found(orch, mock_supabase):
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    result = await orch.get_status("ds1")
    assert result["status"] == "not_found"


async def test_get_status_processing_no_agents(orch, mock_supabase):
    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        sb_tbl = mock_supabase.table.return_value
        sb_tbl.select.return_value.eq.return_value.execute.side_effect = [
            MagicMock(data=[{"processing_status": "processing"}]),
            MagicMock(data=[]),
        ]
        result = await orch.get_status("ds1")

    assert result["status"] == "processing"
    assert result["progress_percentage"] == 10
    assert result["current_agent"] == "profiler"


async def test_get_status_processing_profiler_done(orch, mock_supabase):
    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        sb_tbl = mock_supabase.table.return_value
        sb_tbl.select.return_value.eq.return_value.execute.side_effect = [
            MagicMock(data=[{"processing_status": "processing"}]),
            MagicMock(data=[{"agent_type": "profiler"}]),
        ]
        result = await orch.get_status("ds1")

    assert result["progress_percentage"] == 33
    assert result["current_agent"] == "recommender"


async def test_get_status_processing_recommender_done(orch, mock_supabase):
    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        sb_tbl = mock_supabase.table.return_value
        sb_tbl.select.return_value.eq.return_value.execute.side_effect = [
            MagicMock(data=[{"processing_status": "processing"}]),
            MagicMock(data=[{"agent_type": "profiler"}, {"agent_type": "recommender"}]),
        ]
        result = await orch.get_status("ds1")

    assert result["progress_percentage"] == 66
    assert result["current_agent"] == "validator"


async def test_get_status_processing_all_agents_done(orch, mock_supabase):
    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        sb_tbl = mock_supabase.table.return_value
        sb_tbl.select.return_value.eq.return_value.execute.side_effect = [
            MagicMock(data=[{"processing_status": "processing"}]),
            MagicMock(data=[
                {"agent_type": "profiler"},
                {"agent_type": "recommender"},
                {"agent_type": "validator"},
            ]),
        ]
        result = await orch.get_status("ds1")

    assert result["progress_percentage"] == 90
    assert result["current_agent"] is None


async def test_get_status_completed(orch, mock_supabase):
    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        sb_tbl = mock_supabase.table.return_value
        sb_tbl.select.return_value.eq.return_value.execute.side_effect = [
            MagicMock(data=[{"processing_status": "completed"}]),
            MagicMock(data=[]),
        ]
        result = await orch.get_status("ds1")

    assert result["progress_percentage"] == 100
    assert result["current_agent"] is None


async def test_get_status_exception(orch, mock_supabase):
    async def side_effect(fn):
        raise Exception("db error")

    with patch("asyncio.to_thread", side_effect=side_effect):
        result = await orch.get_status("ds1")

    assert result["status"] == "error"


# ---------------------------------------------------------------------------
# get_results
# ---------------------------------------------------------------------------

async def test_get_results_no_data(orch, mock_supabase):
    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[])
        result = await orch.get_results("ds1")

    assert result is None


async def test_get_results_success(orch, mock_supabase):
    from app.models.base import ChartType

    profiler_data = {
        "dataset_id": "ds1",
        "statistical_summary": {},
        "patterns": {},
        "data_quality": {},
        "processing_time_ms": 0,
    }
    validated_rec_data = {
        "chart_type": ChartType.BAR,
        "confidence": 0.8,
        "data_mapping": {},
        "validation_result": {
            "chart_type": ChartType.BAR,
            "validation_score": 0.8,
            "quality_metrics": {},
            "final_score": 0.8,
        },
        "interaction_config": {},
        "styling_suggestions": {},
        "final_ranking": 1,
    }

    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[
            {"agent_type": "profiler", "analysis_data": profiler_data},
            {"agent_type": "validator", "analysis_data": {"validated_recommendations": [validated_rec_data]}},
        ])
        result = await orch.get_results("ds1")

    assert result is not None
    assert result.success is True


async def test_get_results_profiler_parse_error(orch, mock_supabase):
    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[
            {"agent_type": "profiler", "analysis_data": {"bad": "data"}},
        ])
        result = await orch.get_results("ds1")

    assert result is None


async def test_get_results_validator_parse_error(orch, mock_supabase):
    profiler_data = {
        "dataset_id": "ds1",
        "statistical_summary": {},
        "patterns": {},
        "data_quality": {},
        "processing_time_ms": 0,
    }

    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[
            {"agent_type": "profiler", "analysis_data": profiler_data},
            {"agent_type": "validator", "analysis_data": {"validated_recommendations": [{"bad": "val"}]}},
        ])
        result = await orch.get_results("ds1")

    assert result is None


async def test_get_results_exception(orch, mock_supabase):
    async def side_effect(fn):
        raise Exception("db gone")

    with patch("asyncio.to_thread", side_effect=side_effect):
        result = await orch.get_results("ds1")

    assert result is None


# ---------------------------------------------------------------------------
# _get_current_agent
# ---------------------------------------------------------------------------

def test_get_current_agent_not_processing(orch):
    assert orch._get_current_agent("completed", []) is None
    assert orch._get_current_agent("failed", ["profiler"]) is None


def test_get_current_agent_processing_no_agents(orch):
    assert orch._get_current_agent("processing", []) == "profiler"


def test_get_current_agent_processing_profiler_done(orch):
    assert orch._get_current_agent("processing", ["profiler"]) == "recommender"


def test_get_current_agent_processing_recommender_done(orch):
    assert orch._get_current_agent("processing", ["profiler", "recommender"]) == "validator"


def test_get_current_agent_processing_all_done(orch):
    assert orch._get_current_agent("processing", ["profiler", "recommender", "validator"]) is None


# ---------------------------------------------------------------------------
# _store_agent_analysis
# ---------------------------------------------------------------------------

async def test_real_store_agent_analysis_success(mock_supabase):
    """Test the real _store_agent_analysis (not patched)."""
    with patch("app.services.pipeline_orchestrator.DataProfilerAgent"), \
         patch("app.services.pipeline_orchestrator.ChartRecommenderAgent"), \
         patch("app.services.pipeline_orchestrator.ValidationAgent"), \
         patch("app.services.pipeline_orchestrator.get_supabase_client", return_value=mock_supabase):
        o = PipelineOrchestrator()
        o.supabase = mock_supabase

    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        await o._store_agent_analysis("ds1", "profiler", {"key": "val"}, 0.9, 100)

    mock_supabase.table.assert_called_with("agent_analyses")


async def test_real_store_agent_analysis_exception_does_not_raise(mock_supabase):
    with patch("app.services.pipeline_orchestrator.DataProfilerAgent"), \
         patch("app.services.pipeline_orchestrator.ChartRecommenderAgent"), \
         patch("app.services.pipeline_orchestrator.ValidationAgent"), \
         patch("app.services.pipeline_orchestrator.get_supabase_client", return_value=mock_supabase):
        o = PipelineOrchestrator()
        o.supabase = mock_supabase

    async def side_effect(fn):
        raise Exception("insert failed")

    with patch("asyncio.to_thread", side_effect=side_effect):
        await o._store_agent_analysis("ds1", "profiler", {}, 0.9, 100)


# ---------------------------------------------------------------------------
# _update_dataset_status
# ---------------------------------------------------------------------------

async def test_real_update_dataset_status_success(mock_supabase):
    with patch("app.services.pipeline_orchestrator.DataProfilerAgent"), \
         patch("app.services.pipeline_orchestrator.ChartRecommenderAgent"), \
         patch("app.services.pipeline_orchestrator.ValidationAgent"), \
         patch("app.services.pipeline_orchestrator.get_supabase_client", return_value=mock_supabase):
        o = PipelineOrchestrator()
        o.supabase = mock_supabase

    async def side_effect(fn):
        return fn()

    with patch("asyncio.to_thread", side_effect=side_effect):
        await o._update_dataset_status("ds1", "completed")

    mock_supabase.table.assert_called_with("datasets")


async def test_real_update_dataset_status_exception_does_not_raise(mock_supabase):
    with patch("app.services.pipeline_orchestrator.DataProfilerAgent"), \
         patch("app.services.pipeline_orchestrator.ChartRecommenderAgent"), \
         patch("app.services.pipeline_orchestrator.ValidationAgent"), \
         patch("app.services.pipeline_orchestrator.get_supabase_client", return_value=mock_supabase):
        o = PipelineOrchestrator()
        o.supabase = mock_supabase

    async def side_effect(fn):
        raise Exception("update failed")

    with patch("asyncio.to_thread", side_effect=side_effect):
        await o._update_dataset_status("ds1", "failed")


# ---------------------------------------------------------------------------
# _create_error_response
# ---------------------------------------------------------------------------

async def test_create_error_response_with_partial_results(orch):
    mock_partial = MagicMock()
    mock_partial.success = True
    mock_partial.message = ""
    orch.get_results = AsyncMock(return_value=mock_partial)

    result = await orch._create_error_response("ds1", "oops", 500)

    assert result.success is False
    assert "oops" in result.message


async def test_create_error_response_no_partial_results(orch):
    orch.get_results = AsyncMock(return_value=None)
    mock_response = MagicMock(
        success=False, dataset_id="ds1", processing_time_ms=1000, message="Analysis failed: total failure"
    )

    with patch("app.services.pipeline_orchestrator.AnalysisResponse", return_value=mock_response):
        result = await orch._create_error_response("ds1", "total failure", 1000)

    assert result.success is False
    assert result.dataset_id == "ds1"
    assert result.processing_time_ms == 1000
    assert "total failure" in result.message


async def test_create_error_response_get_results_raises(orch):
    orch.get_results = AsyncMock(side_effect=Exception("secondary failure"))
    mock_response = MagicMock(success=False, dataset_id="ds1")

    with patch("app.services.pipeline_orchestrator.AnalysisResponse", return_value=mock_response):
        result = await orch._create_error_response("ds1", "original error", 200)

    assert result.success is False
    assert result.dataset_id == "ds1"


async def test_analyze_dataset_validated_rec_creation_error(orch):
    """ValidatedRecommendation construction failure is handled gracefully (lines 126-127)."""
    profiler_data = {
        "dataset_id": "ds1",
        "statistical_summary": {},
        "patterns": {},
        "data_quality": {},
        "processing_time_ms": 10,
    }

    orch.profiler_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(data=profiler_data)
    )
    orch.recommender_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(agent_type=AgentType.RECOMMENDER, data={"recommendations": []})
    )
    orch.validation_agent._safe_process = AsyncMock(
        return_value=_make_agent_result(
            agent_type=AgentType.VALIDATOR,
            data={"validated_recommendations": [{"bad": "data"}]}
        )
    )

    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_ctx.sample_data = MagicMock(__len__=lambda self: 5)
    mock_response = MagicMock(success=True, dataset_id="ds1")

    with patch("app.services.pipeline_orchestrator.ProcessingContext") as MockCtx, \
         patch("app.services.pipeline_orchestrator.ComprehensiveDataAnalysis"), \
         patch("app.services.pipeline_orchestrator.ValidatedRecommendation", side_effect=Exception("bad rec")), \
         patch("app.services.pipeline_orchestrator.AnalysisResponse", return_value=mock_response):
        MockCtx.create_from_data.return_value = mock_ctx
        result = await orch.analyze_dataset([{"a": 1}], "ds1")

    # Should still succeed — failed ValidatedRecommendation is skipped
    assert result.success is True


async def test_analyze_dataset_exception_context_cleanup_raises(orch):
    """When context.cleanup() raises in the exception handler, it is silently ignored (lines 169-170)."""
    mock_ctx = MagicMock()
    mock_ctx.dataset_id = "ds1"
    mock_ctx.sample_data = MagicMock(__len__=lambda self: 5)
    mock_ctx.cleanup.side_effect = RuntimeError("cleanup failed")

    orch.profiler_agent._safe_process = AsyncMock(side_effect=RuntimeError("pipeline crash"))
    mock_response = MagicMock(success=False, dataset_id="ds1")

    with patch("app.services.pipeline_orchestrator.ProcessingContext") as MockCtx, \
         patch("app.services.pipeline_orchestrator.AnalysisResponse", return_value=mock_response):
        MockCtx.create_from_data.return_value = mock_ctx
        # Should NOT raise even though both the pipeline and cleanup fail
        result = await orch.analyze_dataset([{"a": 1}], "ds1")

    assert result.success is False
