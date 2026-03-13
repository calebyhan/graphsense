"""
Unit tests for BaseAgent — covers _safe_process, validate_input,
_create_success_result, _create_error_result, and get_fallback_result.
"""

import pandas as pd
import pytest

from app.agents.base_agent import BaseAgent, AgentResult
from app.models.base import AgentType
from app.models.processing_context import ProcessingContext


# ── Concrete subclass used only for testing ───────────────────────────────────

class _OkAgent(BaseAgent):
    """Returns a valid AgentResult from process()."""
    def __init__(self):
        super().__init__(AgentType.PROFILER)

    async def process(self, context: ProcessingContext) -> AgentResult:
        return self._create_success_result({"ok": True}, confidence=0.9)


class _ErrorAgent(BaseAgent):
    """process() raises an exception."""
    def __init__(self):
        super().__init__(AgentType.PROFILER)

    async def process(self, context: ProcessingContext) -> AgentResult:
        raise RuntimeError("boom")


class _BadReturnAgent(BaseAgent):
    """process() returns a non-AgentResult value."""
    def __init__(self):
        super().__init__(AgentType.PROFILER)

    async def process(self, context: ProcessingContext) -> AgentResult:
        return {"not": "an AgentResult"}  # type: ignore


class _BrokenFallbackAgent(BaseAgent):
    """process() and get_fallback_result() both raise."""
    def __init__(self):
        super().__init__(AgentType.PROFILER)

    async def process(self, context: ProcessingContext) -> AgentResult:
        raise RuntimeError("process failed")

    def get_fallback_result(self, context, error=None) -> AgentResult:
        raise RuntimeError("fallback also failed")


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def ctx():
    data = [{"a": 1, "b": 2}, {"a": 3, "b": 4}]
    return ProcessingContext.create_from_data("test-id", data)


@pytest.fixture
def empty_ctx():
    return ProcessingContext(
        dataset_id="empty",
        sample_data=pd.DataFrame(),
        original_size=0,
    )


# ── validate_input ────────────────────────────────────────────────────────────

def test_validate_input_ok(ctx):
    agent = _OkAgent()
    assert agent.validate_input(ctx) is True


def test_validate_input_empty_df(empty_ctx):
    agent = _OkAgent()
    assert agent.validate_input(empty_ctx) is False


def test_validate_input_none():
    agent = _OkAgent()
    assert agent.validate_input(None) is False


def test_validate_input_exception():
    """sample_data attribute raises — should return False."""
    from unittest.mock import MagicMock
    agent = _OkAgent()
    bad_ctx = MagicMock()
    bad_ctx.sample_data = MagicMock()
    bad_ctx.sample_data.empty = MagicMock(side_effect=Exception("oops"))
    assert agent.validate_input(bad_ctx) is False


# ── get_fallback_result (base implementation) ─────────────────────────────────

def test_get_fallback_result_base(ctx):
    """Base implementation returns success=False with no data."""

    class _NoOverrideAgent(BaseAgent):
        async def process(self, context):
            pass

    agent = _NoOverrideAgent(AgentType.RECOMMENDER)
    result = agent.get_fallback_result(ctx, "test error")
    assert result.success is False
    assert result.confidence == 0.0
    assert "test error" in result.error_message


def test_get_fallback_result_no_error(ctx):
    class _NoOverrideAgent(BaseAgent):
        async def process(self, context):
            pass

    agent = _NoOverrideAgent(AgentType.VALIDATOR)
    result = agent.get_fallback_result(ctx)
    assert result.success is False
    assert result.error_message is not None


# ── _create_success_result ────────────────────────────────────────────────────

def test_create_success_result():
    agent = _OkAgent()
    result = agent._create_success_result({"x": 1}, confidence=0.75, processing_time_ms=100)
    assert result.success is True
    assert result.data == {"x": 1}
    assert result.confidence == 0.75
    assert result.processing_time_ms == 100


def test_create_success_result_clamps_confidence():
    agent = _OkAgent()
    result = agent._create_success_result({}, confidence=1.5)
    assert result.confidence == 1.0
    result2 = agent._create_success_result({}, confidence=-0.5)
    assert result2.confidence == 0.0


# ── _create_error_result ──────────────────────────────────────────────────────

def test_create_error_result():
    agent = _OkAgent()
    result = agent._create_error_result("something broke", processing_time_ms=50)
    assert result.success is False
    assert result.error_message == "something broke"
    assert result.processing_time_ms == 50
    assert result.confidence == 0.0


# ── _safe_process ─────────────────────────────────────────────────────────────

async def test_safe_process_success(ctx):
    agent = _OkAgent()
    result = await agent._safe_process(ctx)
    assert result.success is True
    assert result.data == {"ok": True}


async def test_safe_process_invalid_input(empty_ctx):
    agent = _OkAgent()
    result = await agent._safe_process(empty_ctx)
    assert result.success is False


async def test_safe_process_bad_return_type(ctx):
    """process() returns a non-AgentResult — should fall back."""
    agent = _BadReturnAgent()
    result = await agent._safe_process(ctx)
    assert result.success is False


async def test_safe_process_process_exception_uses_fallback(ctx):
    """process() raises — fallback is used."""
    agent = _ErrorAgent()
    result = await agent._safe_process(ctx)
    assert result.success is False


async def test_safe_process_both_fail(ctx):
    """Both process() and get_fallback_result() raise — returns minimal error result."""
    agent = _BrokenFallbackAgent()
    result = await agent._safe_process(ctx)
    assert result.success is False
    assert result.confidence == 0.0
