"""
Unit tests for GeminiAIService.
All Gemini API calls are mocked — no real network connections.
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.gemini_ai_service import GeminiAIService, get_gemini_service
import app.services.gemini_ai_service as _module


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_singleton():
    """Reset the global singleton between tests."""
    _module._gemini_service = None
    yield
    _module._gemini_service = None


@pytest.fixture
def service():
    """GeminiAIService with mocked Gemini client."""
    with patch("app.services.gemini_ai_service.genai") as mock_genai, \
         patch("app.services.gemini_ai_service.types") as mock_types:
        mock_types.GenerateContentConfig.return_value = MagicMock()
        mock_genai.Client.return_value = MagicMock()
        svc = GeminiAIService()
        # Replace client with a controllable mock
        svc.client = MagicMock()
        svc.client.aio.models.generate_content = AsyncMock()
        return svc


# ---------------------------------------------------------------------------
# __init__
# ---------------------------------------------------------------------------

def test_init_sets_attributes(service):
    assert service.response_cache is not None
    assert service.min_request_interval == 1.0
    assert service.last_request_time is None


# ---------------------------------------------------------------------------
# generate_data_profile_insights
# ---------------------------------------------------------------------------

async def test_generate_profiler_insights_cache_miss_then_hit(service):
    response_mock = MagicMock()
    response_mock.text = json.dumps({
        "insights": ["hi"],
        "data_quality_score": 0.9,
        "recommended_actions": [],
        "analysis_opportunities": [],
    })
    service.client.aio.models.generate_content.return_value = response_mock

    with patch.object(service, "_rate_limit", new_callable=AsyncMock):
        result1 = await service.generate_data_profile_insights({}, [], {})
        result2 = await service.generate_data_profile_insights({}, [], {})

    # Second call should use cache — API called only once
    service.client.aio.models.generate_content.assert_awaited_once()
    assert result1["insights"] == ["hi"]
    assert result1 is result2  # same cached object


async def test_generate_profiler_insights_exception_returns_fallback(service):
    service.client.aio.models.generate_content.side_effect = Exception("boom")

    with patch.object(service, "_rate_limit", new_callable=AsyncMock), \
         patch("asyncio.sleep", new_callable=AsyncMock):
        result = await service.generate_data_profile_insights({}, [], {})

    assert "insights" in result
    assert "data_quality_score" in result


# ---------------------------------------------------------------------------
# generate_chart_recommendations
# ---------------------------------------------------------------------------

async def test_generate_chart_recommendations_cache_miss_then_hit(service):
    response_mock = MagicMock()
    response_mock.text = json.dumps({
        "recommendations": [{"chart_type": "bar", "confidence": 0.8}]
    })
    service.client.aio.models.generate_content.return_value = response_mock

    ctx = {"columns": [], "row_count": 0}
    with patch.object(service, "_rate_limit", new_callable=AsyncMock):
        result1 = await service.generate_chart_recommendations(ctx)
        result2 = await service.generate_chart_recommendations(ctx)

    service.client.aio.models.generate_content.assert_awaited_once()
    assert result1 is result2


async def test_generate_chart_recommendations_exception_returns_fallback(service):
    service.client.aio.models.generate_content.side_effect = Exception("fail")

    ctx = {
        "columns": [
            {"name": "col1", "type": "numeric"},
            {"name": "col2", "type": "categorical"},
        ],
        "row_count": 10,
    }
    with patch.object(service, "_rate_limit", new_callable=AsyncMock), \
         patch("asyncio.sleep", new_callable=AsyncMock):
        result = await service.generate_chart_recommendations(ctx)

    assert isinstance(result, list)
    # Fallback recs are tagged so callers can distinguish them from real AI output
    assert all(r.get("_source") == "fallback" for r in result)


# ---------------------------------------------------------------------------
# validate_chart_recommendations
# ---------------------------------------------------------------------------

async def test_validate_chart_recommendations_cache_miss_then_hit(service):
    response_mock = MagicMock()
    response_mock.text = json.dumps({
        "validations": [{"chart_type": "bar", "final_score": 0.9}]
    })
    service.client.aio.models.generate_content.return_value = response_mock

    with patch.object(service, "_rate_limit", new_callable=AsyncMock):
        result1 = await service.validate_chart_recommendations([], {})
        result2 = await service.validate_chart_recommendations([], {})

    service.client.aio.models.generate_content.assert_awaited_once()
    assert result1 is result2


async def test_validate_chart_recommendations_exception_returns_fallback(service):
    service.client.aio.models.generate_content.side_effect = Exception("fail")
    recs = [{"chart_type": "bar"}]

    with patch.object(service, "_rate_limit", new_callable=AsyncMock), \
         patch("asyncio.sleep", new_callable=AsyncMock):
        result = await service.validate_chart_recommendations(recs, {})

    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["chart_type"] == "bar"


# ---------------------------------------------------------------------------
# _generate_with_retry
# ---------------------------------------------------------------------------

async def test_generate_with_retry_success_first_attempt(service):
    response = MagicMock()
    response.text = "hello"
    service.client.aio.models.generate_content.return_value = response

    with patch.object(service, "_rate_limit", new_callable=AsyncMock):
        text = await service._generate_with_retry("prompt")

    assert text == "hello"
    service.client.aio.models.generate_content.assert_awaited_once()


async def test_generate_with_retry_timeout_then_success(service):
    response = MagicMock()
    response.text = "ok"
    service.client.aio.models.generate_content.side_effect = [
        asyncio.TimeoutError(),
        response,
    ]

    with patch.object(service, "_rate_limit", new_callable=AsyncMock), \
         patch("asyncio.sleep", new_callable=AsyncMock):
        text = await service._generate_with_retry("prompt", max_retries=2)

    assert text == "ok"


async def test_generate_with_retry_all_timeouts_raises(service):
    service.client.aio.models.generate_content.side_effect = asyncio.TimeoutError()

    with patch.object(service, "_rate_limit", new_callable=AsyncMock), \
         patch("asyncio.sleep", new_callable=AsyncMock), \
         pytest.raises(Exception, match="timed out"):
        await service._generate_with_retry("prompt", max_retries=2)


async def test_generate_with_retry_exception_then_success(service):
    response = MagicMock()
    response.text = "recovered"
    service.client.aio.models.generate_content.side_effect = [
        RuntimeError("transient"),
        response,
    ]

    with patch.object(service, "_rate_limit", new_callable=AsyncMock), \
         patch("asyncio.sleep", new_callable=AsyncMock):
        text = await service._generate_with_retry("prompt", max_retries=2)

    assert text == "recovered"


async def test_generate_with_retry_all_exceptions_reraises(service):
    service.client.aio.models.generate_content.side_effect = RuntimeError("permanent")

    with patch.object(service, "_rate_limit", new_callable=AsyncMock), \
         patch("asyncio.sleep", new_callable=AsyncMock), \
         pytest.raises(RuntimeError, match="permanent"):
        await service._generate_with_retry("prompt", max_retries=2)


# ---------------------------------------------------------------------------
# _rate_limit
# ---------------------------------------------------------------------------

async def test_rate_limit_no_previous_request(service):
    service.last_request_time = None
    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        await service._rate_limit()
    mock_sleep.assert_not_awaited()
    assert service.last_request_time is not None


async def test_rate_limit_recent_request_sleeps(service):
    import time
    service.last_request_time = time.time()  # just now
    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        await service._rate_limit()
    mock_sleep.assert_awaited_once()


async def test_rate_limit_old_request_does_not_sleep(service):
    service.last_request_time = 0.0  # epoch — definitely old enough
    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        await service._rate_limit()
    mock_sleep.assert_not_awaited()


# ---------------------------------------------------------------------------
# _generate_cache_key
# ---------------------------------------------------------------------------

def test_generate_cache_key_deterministic(service):
    k1 = service._generate_cache_key("profiler", "same prompt")
    k2 = service._generate_cache_key("profiler", "same prompt")
    assert k1 == k2


def test_generate_cache_key_differs_by_type(service):
    k1 = service._generate_cache_key("profiler", "prompt")
    k2 = service._generate_cache_key("recommender", "prompt")
    assert k1 != k2


# ---------------------------------------------------------------------------
# Build prompt methods
# ---------------------------------------------------------------------------

def test_build_profiler_prompt_contains_row_count(service):
    prompt = service._build_profiler_prompt({"row_count": 42}, [], {})
    assert "42" in prompt


def test_build_profiler_prompt_numeric_column_with_mean(service):
    """Lines 230-233: columns with mean/min/max/skewness are included in compact summary."""
    stat_summary = {
        "row_count": 100,
        "column_count": 1,
        "columns": {
            "price": {
                "data_type": "numeric",
                "null_percentage": 0,
                "unique_count": 80,
                "mean": 42.5,
                "min": 1.0,
                "max": 99.0,
                "skewness": 1.2,
            }
        },
    }
    prompt = service._build_profiler_prompt(stat_summary, [], {})
    assert "price" in prompt


def test_build_profiler_prompt_top_values_branch(service):
    """Lines 234-236: columns with top_values (no mean) are included in compact summary."""
    stat_summary = {
        "row_count": 100,
        "column_count": 1,
        "columns": {
            "category": {
                "data_type": "categorical",
                "null_percentage": 0,
                "unique_count": 5,
                # no 'mean' key → triggers elif top_values branch
                "top_values": {"a": 40, "b": 30, "c": 20, "d": 5, "e": 5},
            }
        },
    }
    prompt = service._build_profiler_prompt(stat_summary, [], {})
    assert "category" in prompt


def test_build_recommender_prompt_contains_row_count(service):
    prompt = service._build_recommender_prompt({"row_count": 10, "columns": []})
    assert "10" in prompt


def test_build_recommender_prompt_truncates_beyond_30_columns(service):
    """Lines 280-281: >30 columns triggers a warning log and truncation to 30."""
    columns = [{"name": f"col_{i}", "type": "numeric"} for i in range(35)]
    ctx = {"row_count": 100, "column_count": 35, "columns": columns}
    prompt = service._build_recommender_prompt(ctx)
    # The prompt should still be a non-empty string
    assert len(prompt) > 0
    # Only 30 columns should appear: col_30..col_34 should be absent
    assert "col_30" not in prompt


def test_build_validator_prompt_contains_recommendations(service):
    recs = [{"chart_type": "bar"}]
    prompt = service._build_validator_prompt(recs, {})
    assert "bar" in prompt


def test_build_validator_prompt_numeric_column_with_mean(service):
    """Lines 358-360: validator prompt includes numeric column with mean/min/max."""
    recs = [{"chart_type": "bar"}]
    data_characteristics = {
        "profiler_data": {
            "row_count": 50,
            "columns": {
                "revenue": {
                    "data_type": "numeric",
                    "unique_count": 50,
                    "mean": 1000.0,
                    "min": 100.0,
                    "max": 5000.0,
                }
            },
        },
        "correlations": [],
    }
    prompt = service._build_validator_prompt(recs, data_characteristics)
    assert "revenue" in prompt


def test_build_validator_prompt_top_values_branch(service):
    """Lines 361-363: profiler columns with top_values (no mean) in validator prompt."""
    recs = [{"chart_type": "bar"}]
    data_characteristics = {
        "profiler_data": {
            "row_count": 50,
            "columns": {
                "region": {
                    "data_type": "categorical",
                    "unique_count": 4,
                    # no 'mean' → elif top_values branch
                    "top_values": {"north": 20, "south": 15, "east": 10, "west": 5},
                }
            },
        },
        "correlations": [],
    }
    prompt = service._build_validator_prompt(recs, data_characteristics)
    assert "region" in prompt


# ---------------------------------------------------------------------------
# _parse_profiler_response
# ---------------------------------------------------------------------------

def test_parse_profiler_response_valid_json(service):
    raw = json.dumps({
        "insights": ["x"],
        "data_quality_score": 0.8,
        "recommended_actions": [],
        "analysis_opportunities": [],
    })
    result = service._parse_profiler_response(raw)
    assert result["insights"] == ["x"]


def test_parse_profiler_response_no_json_match_uses_text(service):
    result = service._parse_profiler_response("plain text no braces")
    # Falls back to inserting text as first insight
    assert "insights" in result


def test_parse_profiler_response_invalid_json_returns_fallback(service):
    # Has braces but invalid JSON
    result = service._parse_profiler_response("{not valid json}")
    assert "insights" in result


def test_parse_profiler_response_exception_returns_fallback(service):
    """Lines 452-454: unexpected exception from _extract_json_object → fallback."""
    with patch.object(service, "_extract_json_object", side_effect=RuntimeError("boom")):
        result = service._parse_profiler_response('{"any": "json"}')
    assert "insights" in result


# ---------------------------------------------------------------------------
# _parse_recommender_response
# ---------------------------------------------------------------------------

def test_parse_recommender_response_valid_json(service):
    raw = json.dumps({"recommendations": [{"chart_type": "scatter"}]})
    result = service._parse_recommender_response(raw)
    assert result == [{"chart_type": "scatter"}]


def test_parse_recommender_response_no_json_match(service):
    result = service._parse_recommender_response("no braces here")
    assert result == []


def test_parse_recommender_response_invalid_json(service):
    result = service._parse_recommender_response("{broken}")
    assert result == []


def test_parse_recommender_response_wrong_top_level_key(service):
    # Gemini used "charts" instead of "recommendations" — should return [] and log ERROR
    raw = json.dumps({"charts": [{"chart_type": "bar"}]})
    result = service._parse_recommender_response(raw)
    assert result == []


def test_parse_recommender_response_empty_list_returns_empty(service):
    """Line 474: valid JSON with empty recommendations list → warning logged, empty list returned."""
    raw = json.dumps({"recommendations": []})
    result = service._parse_recommender_response(raw)
    assert result == []


def test_parse_recommender_response_exception_returns_empty(service):
    """Lines 476-478: unexpected exception from _extract_json_object → empty list."""
    with patch.object(service, "_extract_json_object", side_effect=RuntimeError("boom")):
        result = service._parse_recommender_response('{"recommendations": []}')
    assert result == []


def test_parse_recommender_response_text_with_trailing_braces(service):
    # Trailing {column_name} template text after JSON — raw_decode should still find the object
    raw = json.dumps({"recommendations": [{"chart_type": "line"}]}) + " Use {column} as axis."
    result = service._parse_recommender_response(raw)
    assert result == [{"chart_type": "line"}]


# ---------------------------------------------------------------------------
# _parse_validator_response
# ---------------------------------------------------------------------------

def test_parse_validator_response_valid_json(service):
    raw = json.dumps({"validations": [{"chart_type": "pie", "final_score": 0.7}]})
    result = service._parse_validator_response(raw)
    assert result == [{"chart_type": "pie", "final_score": 0.7}]


def test_parse_validator_response_no_json_match(service):
    result = service._parse_validator_response("no braces")
    assert result == []


def test_parse_validator_response_invalid_json(service):
    result = service._parse_validator_response("{bad}")
    assert result == []


def test_parse_validator_response_wrong_top_level_key(service):
    """Lines 492-496: valid JSON but missing 'validations' key → empty list."""
    raw = json.dumps({"checks": [{"chart_type": "bar"}]})
    result = service._parse_validator_response(raw)
    assert result == []


def test_parse_validator_response_exception_returns_empty(service):
    """Lines 498-500: unexpected exception from _extract_json_object → empty list."""
    with patch.object(service, "_extract_json_object", side_effect=RuntimeError("boom")):
        result = service._parse_validator_response('{"validations": []}')
    assert result == []


# ---------------------------------------------------------------------------
# Fallback methods
# ---------------------------------------------------------------------------

def test_get_profiler_fallback_structure(service):
    fb = service._get_profiler_fallback()
    assert "insights" in fb
    assert "data_quality_score" in fb
    assert "recommended_actions" in fb
    assert "analysis_opportunities" in fb


def test_get_recommender_fallback_with_cat_and_num(service):
    ctx = {"columns": [{"name": "category", "type": "categorical"}, {"name": "value", "type": "numeric"}]}
    result = service._get_recommender_fallback(ctx)
    chart_types = [r["chart_type"] for r in result]
    assert "bar" in chart_types


def test_get_recommender_fallback_with_two_numerics(service):
    ctx = {"columns": [{"name": "x", "type": "numeric"}, {"name": "y", "type": "numeric"}]}
    result = service._get_recommender_fallback(ctx)
    chart_types = [r["chart_type"] for r in result]
    assert "scatter" in chart_types


def test_get_recommender_fallback_empty_columns(service):
    result = service._get_recommender_fallback({"columns": []})
    assert result == []


def test_get_recommender_fallback_scatter_with_categorical_color(service):
    ctx = {"columns": [
        {"name": "x", "type": "numeric"},
        {"name": "y", "type": "numeric"},
        {"name": "cat", "type": "categorical"},
    ]}
    result = service._get_recommender_fallback(ctx)
    scatter = next(r for r in result if r["chart_type"] == "scatter")
    assert scatter["color"] == "cat"


def test_get_validator_fallback_maps_recs(service):
    recs = [{"chart_type": "bar"}, {"chart_type": "line"}]
    result = service._get_validator_fallback(recs)
    assert len(result) == 2
    assert result[0]["chart_type"] == "bar"
    assert result[1]["chart_type"] == "line"
    assert "scores" in result[0]
    assert "final_score" in result[0]


def test_get_validator_fallback_missing_chart_type(service):
    recs = [{}]
    result = service._get_validator_fallback(recs)
    assert result[0]["chart_type"] == "bar"  # default


# ---------------------------------------------------------------------------
# get_cache_stats
# ---------------------------------------------------------------------------

def test_get_cache_stats(service):
    stats = service.get_cache_stats()
    assert "cache_size" in stats
    assert "cache_maxsize" in stats
    assert "cache_ttl" in stats
    assert stats["cache_maxsize"] == 1000


# ---------------------------------------------------------------------------
# get_gemini_service (singleton)
# ---------------------------------------------------------------------------

def test_get_gemini_service_creates_instance():
    with patch("app.services.gemini_ai_service.genai"), \
         patch("app.services.gemini_ai_service.types"):
        svc = get_gemini_service()
    assert isinstance(svc, GeminiAIService)


def test_get_gemini_service_returns_same_instance():
    with patch("app.services.gemini_ai_service.genai"), \
         patch("app.services.gemini_ai_service.types"):
        svc1 = get_gemini_service()
        svc2 = get_gemini_service()
    assert svc1 is svc2
