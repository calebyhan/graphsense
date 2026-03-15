"""
Unit tests for agent_pipeline.py.
All external dependencies (agents, Supabase) are mocked.
"""

import pytest
from decimal import Decimal
from enum import Enum
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.agent_pipeline import AgentPipelineService, convert_to_json_serializable


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_supabase():
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
def svc(mock_supabase):
    with patch("app.services.agent_pipeline.EnhancedDataProfilerAgent") as MockProfiler, \
         patch("app.services.agent_pipeline.ChartRecommenderAgent") as MockRecommender, \
         patch("app.services.agent_pipeline.ValidationAgent") as MockValidator, \
         patch("app.services.agent_pipeline.get_supabase_client", return_value=mock_supabase):
        service = AgentPipelineService()
        service.profiler_agent = MockProfiler.return_value
        service.recommender_agent = MockRecommender.return_value
        service.validation_agent = MockValidator.return_value
        service.supabase = mock_supabase
        return service


# ---------------------------------------------------------------------------
# convert_to_json_serializable — branch coverage
# ---------------------------------------------------------------------------

class _MyEnum(Enum):
    A = "enum_value"


def test_serialize_none():
    assert convert_to_json_serializable(None) is None


def test_serialize_enum():
    assert convert_to_json_serializable(_MyEnum.A) == "enum_value"


def test_serialize_enum_like_value_name():
    """Object with 'value' and '_name_' attrs but not an Enum."""
    class EnumLike:
        value = 42
        _name_ = "fake"
    assert convert_to_json_serializable(EnumLike()) == 42


def test_serialize_value_attr():
    """Object with '_value_' but no 'value'+'_name_' combo."""
    class WithValue_:
        _value_ = 99
    # _name_ not present → skips branch 2, hits branch 3
    obj = WithValue_()
    del obj.__class__._value_  # prevent class-level attr; use instance attr instead
    obj._value_ = 99  # set as instance attribute
    # Rebuild without _name_ so branch 2 won't fire
    class NoName:
        pass
    no_name = NoName()
    no_name._value_ = "secret"
    assert convert_to_json_serializable(no_name) == "secret"


def test_serialize_numpy_scalar():
    """Object with 'item()' method (numpy scalar-like)."""
    class NumpyScalar:
        def item(self):
            return 7.0
    # Ensure it doesn't accidentally match earlier branches
    obj = NumpyScalar()
    assert convert_to_json_serializable(obj) == 7.0


def test_serialize_numpy_array():
    """Object with 'tolist()' method (numpy array-like) — must not have 'item'."""
    class NumpyArray:
        def tolist(self):
            return [1, 2, 3]
    assert convert_to_json_serializable(NumpyArray()) == [1, 2, 3]


def test_serialize_decimal():
    assert convert_to_json_serializable(Decimal("3.14")) == pytest.approx(3.14)


def test_serialize_bytes():
    assert convert_to_json_serializable(b"hello") == "hello"


def test_serialize_dict_with_name_value_keys():
    """Dict containing '_name_' and '_value_' — returns _value_."""
    d = {"_name_": "X", "_value_": "extracted"}
    assert convert_to_json_serializable(d) == "extracted"


def test_serialize_plain_dict():
    d = {"a": 1, "b": [2, 3]}
    result = convert_to_json_serializable(d)
    assert result == {"a": 1, "b": [2, 3]}


def test_serialize_list():
    assert convert_to_json_serializable([1, "x", None]) == [1, "x", None]


def test_serialize_tuple():
    assert convert_to_json_serializable((1, 2)) == [1, 2]


def test_serialize_set():
    result = convert_to_json_serializable({42})
    assert result == [42]


def test_serialize_pydantic_like_with_model_dump():
    """Object with __dict__ and dict() method → calls model_dump()."""
    class PydanticLike:
        def dict(self):
            return {}

        def model_dump(self):
            return {"field": "val"}

    result = convert_to_json_serializable(PydanticLike())
    assert result == {"field": "val"}


def test_serialize_plain_object_with_dict_attr():
    """Object with __dict__ but no 'dict' method → uses __dict__."""
    class Plain:
        def __init__(self):
            self.x = 10

    assert convert_to_json_serializable(Plain()) == {"x": 10}


def test_serialize_json_serializable_passthrough():
    assert convert_to_json_serializable(3.14) == 3.14
    assert convert_to_json_serializable("string") == "string"
    assert convert_to_json_serializable(True) is True


def test_serialize_non_json_serializable_falls_back_to_str():
    class Unserializable:
        def __repr__(self):
            return "Unserializable()"

    # Must not match earlier branches: no 'value'+'_name_', no 'item', no 'tolist',
    # not Decimal, not bytes, not dict/list/tuple/set, no __dict__.
    import ctypes
    # Use a simple object without __dict__ by using __slots__
    class Slotted:
        __slots__ = []
        def __repr__(self):
            return "slotted"

    result = convert_to_json_serializable(Slotted())
    assert result == "slotted"


# ---------------------------------------------------------------------------
# AgentPipelineService.__init__
# ---------------------------------------------------------------------------

def test_init_creates_agents_and_supabase(mock_supabase):
    with patch("app.services.agent_pipeline.EnhancedDataProfilerAgent") as P, \
         patch("app.services.agent_pipeline.ChartRecommenderAgent") as R, \
         patch("app.services.agent_pipeline.ValidationAgent") as V, \
         patch("app.services.agent_pipeline.get_supabase_client", return_value=mock_supabase):
        svc = AgentPipelineService()
    P.assert_called_once()
    R.assert_called_once()
    V.assert_called_once()
    assert svc.supabase is mock_supabase


# ---------------------------------------------------------------------------
# analyze_dataset
# ---------------------------------------------------------------------------

async def test_analyze_dataset_success(svc, mock_supabase):
    mock_analysis = MagicMock()
    mock_analysis.dataset_id = None
    mock_analysis.model_dump.return_value = {"dataset_id": "ds1"}

    mock_rec = MagicMock()
    mock_rec.model_dump.return_value = {"chart_type": "bar"}

    mock_val = MagicMock()
    mock_val.model_dump.return_value = {"chart_type": "bar"}

    svc.profiler_agent.analyze = AsyncMock(return_value=mock_analysis)
    svc.recommender_agent.recommend = AsyncMock(return_value=[mock_rec])
    svc.validation_agent.validate = AsyncMock(return_value=[mock_val])

    mock_response = MagicMock(success=True, dataset_id="ds1")

    with patch("app.services.agent_pipeline.AnalysisResponse", return_value=mock_response):
        result = await svc.analyze_dataset([{"col": 1}], "ds1")

    assert result.success is True
    assert result.dataset_id == "ds1"
    assert mock_analysis.dataset_id == "ds1"


async def test_analyze_dataset_exception_updates_status_and_raises(svc, mock_supabase):
    svc.profiler_agent.analyze = AsyncMock(side_effect=RuntimeError("fail"))
    svc._update_dataset_status = AsyncMock()

    with pytest.raises(RuntimeError, match="fail"):
        await svc.analyze_dataset([{"col": 1}], "ds1")

    svc._update_dataset_status.assert_awaited_with("ds1", "failed")


# ---------------------------------------------------------------------------
# get_analysis_status
# ---------------------------------------------------------------------------

async def test_get_analysis_status_not_found(svc, mock_supabase):
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    result = await svc.get_analysis_status("ds1")
    assert result["status"] == "not_found"


async def test_get_analysis_status_found_with_agents(svc, mock_supabase):
    tbl = mock_supabase.table.return_value
    # First call (datasets table) returns status
    tbl.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"processing_status": "completed"}]
    )
    # Second call (agent_analyses table) returns agents
    tbl.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"processing_status": "completed"}]),
        MagicMock(data=[{"agent_type": "profiler"}, {"agent_type": "recommender"}]),
    ]

    result = await svc.get_analysis_status("ds1")
    assert result["status"] == "completed"
    assert result["progress"]["profiler"] is True
    assert result["progress"]["recommender"] is True
    assert result["progress"]["validator"] is False


async def test_get_analysis_status_exception_returns_error(svc, mock_supabase):
    mock_supabase.table.side_effect = Exception("db error")
    result = await svc.get_analysis_status("ds1")
    assert result["status"] == "error"
    assert "error" in result


# ---------------------------------------------------------------------------
# get_analysis_results
# ---------------------------------------------------------------------------

async def test_get_analysis_results_no_data_returns_none(svc, mock_supabase):
    tbl = mock_supabase.table.return_value
    tbl.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[])
    result = await svc.get_analysis_results("ds1")
    assert result is None


async def test_get_analysis_results_success(svc, mock_supabase):
    profiler_data = {
        "dataset_id": "ds1",
        "statistical_summary": {},
        "patterns": {},
        "data_quality": {},
        "processing_time_ms": 0,
    }
    from app.models.base import ChartType
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
    tbl = mock_supabase.table.return_value
    tbl.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[
        {"agent_type": "profiler", "analysis_data": profiler_data},
        {"agent_type": "recommender", "analysis_data": {"recommendations": []}},
        {"agent_type": "validator", "analysis_data": {"validated_recommendations": [validated_rec_data]}},
    ])

    result = await svc.get_analysis_results("ds1")
    assert result is not None
    assert result.success is True


async def test_get_analysis_results_profiler_parse_error_creates_minimal(svc, mock_supabase):
    tbl = mock_supabase.table.return_value
    from app.models.base import ChartType
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
    tbl.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[
        {"agent_type": "profiler", "analysis_data": {"bad": "data"}},  # missing required fields → error
        {"agent_type": "validator", "analysis_data": {"validated_recommendations": [validated_rec_data]}},
    ])

    result = await svc.get_analysis_results("ds1")
    # Minimal profiler data is created — result should succeed
    assert result is not None


async def test_get_analysis_results_recommender_parse_error(svc, mock_supabase):
    tbl = mock_supabase.table.return_value
    profiler_data = {
        "dataset_id": "ds1",
        "statistical_summary": {},
        "patterns": {},
        "data_quality": {},
        "processing_time_ms": 0,
    }
    tbl.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[
        {"agent_type": "profiler", "analysis_data": profiler_data},
        {"agent_type": "recommender", "analysis_data": {"recommendations": [{"bad": "rec"}]}},
    ])

    result = await svc.get_analysis_results("ds1")
    # Missing validated_recommendations → returns None
    assert result is None


async def test_get_analysis_results_validator_parse_error(svc, mock_supabase):
    tbl = mock_supabase.table.return_value
    profiler_data = {
        "dataset_id": "ds1",
        "statistical_summary": {},
        "patterns": {},
        "data_quality": {},
        "processing_time_ms": 0,
    }
    tbl.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[
        {"agent_type": "profiler", "analysis_data": profiler_data},
        {"agent_type": "validator", "analysis_data": {"validated_recommendations": [{"bad": "val"}]}},
    ])

    result = await svc.get_analysis_results("ds1")
    assert result is None  # validator parse error → empty list → None


async def test_get_analysis_results_exception_returns_none(svc, mock_supabase):
    mock_supabase.table.side_effect = Exception("db gone")
    result = await svc.get_analysis_results("ds1")
    assert result is None


# ---------------------------------------------------------------------------
# _store_agent_analysis
# ---------------------------------------------------------------------------

async def test_store_profiler_analysis(svc, mock_supabase):
    await svc._store_agent_analysis("ds1", "profiler", {"processing_time_ms": 50})
    mock_supabase.table.assert_called_with("agent_analyses")


async def test_store_recommender_analysis_with_recs(svc, mock_supabase):
    data = {
        "recommendations": [{"confidence": 0.9}, {"confidence": 0.7}],
        "processing_time_ms": 100,
    }
    await svc._store_agent_analysis("ds1", "recommender", data)
    inserted = mock_supabase.table.return_value.insert.call_args[0][0]
    assert abs(inserted["confidence_score"] - 0.8) < 0.01


async def test_store_recommender_analysis_no_recs(svc, mock_supabase):
    data = {"recommendations": [], "processing_time_ms": 10}
    await svc._store_agent_analysis("ds1", "recommender", data)
    inserted = mock_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["confidence_score"] is None


async def test_store_validator_analysis_with_recs(svc, mock_supabase):
    data = {
        "validated_recommendations": [
            {"validation_result": {"final_score": 0.6}},
            {"validation_result": {"final_score": 0.8}},
        ],
        "processing_time_ms": 20,
    }
    await svc._store_agent_analysis("ds1", "validator", data)
    inserted = mock_supabase.table.return_value.insert.call_args[0][0]
    assert abs(inserted["confidence_score"] - 0.7) < 0.01


async def test_store_validator_analysis_no_recs(svc, mock_supabase):
    data = {"validated_recommendations": [], "processing_time_ms": 5}
    await svc._store_agent_analysis("ds1", "validator", data)
    inserted = mock_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["confidence_score"] is None


async def test_store_analysis_exception_does_not_raise(svc, mock_supabase):
    mock_supabase.table.side_effect = Exception("insert failed")
    # Should not raise
    await svc._store_agent_analysis("ds1", "profiler", {})


# ---------------------------------------------------------------------------
# _update_dataset_status
# ---------------------------------------------------------------------------

async def test_update_dataset_status_success(svc, mock_supabase):
    await svc._update_dataset_status("ds1", "completed")
    mock_supabase.table.assert_called_with("datasets")


async def test_update_dataset_status_exception_does_not_raise(svc, mock_supabase):
    mock_supabase.table.side_effect = Exception("update failed")
    await svc._update_dataset_status("ds1", "failed")
