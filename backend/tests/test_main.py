"""
Tests for main.py — FastAPI application entry point.
Covers: lifespan (success + DB failure), general exception handler,
and the __main__ uvicorn entrypoint block.
"""

import pathlib
import runpy
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

async def test_lifespan_success():
    """Lifespan initialises and shuts down cleanly when all deps succeed."""
    from main import lifespan, app as fastapi_app

    with (
        patch("main.get_supabase_client") as mock_supa,
        patch("app.utils.memory_manager.initialize_memory_manager", new=AsyncMock()) as mock_init,
        patch("app.utils.memory_manager.shutdown_memory_manager", new=AsyncMock()) as mock_shut,
    ):
        async with lifespan(fastapi_app):
            pass

    mock_supa.assert_called_once()
    mock_init.assert_awaited_once()
    mock_shut.assert_awaited_once()


async def test_lifespan_db_failure_raises():
    """Lifespan re-raises when the Supabase connection fails."""
    from main import lifespan, app as fastapi_app

    with patch("main.get_supabase_client", side_effect=RuntimeError("DB unavailable")):
        with pytest.raises(RuntimeError, match="DB unavailable"):
            async with lifespan(fastapi_app):
                pass  # pragma: no cover


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

async def test_general_exception_handler_returns_500():
    """Unhandled exceptions yield a 500 JSON response."""
    from main import general_exception_handler
    from fastapi.responses import JSONResponse
    import json

    request = MagicMock()
    exc = RuntimeError("unexpected boom")

    response = await general_exception_handler(request, exc)

    assert isinstance(response, JSONResponse)
    assert response.status_code == 500
    body = json.loads(response.body)
    assert body["error"] == "Internal server error"


# ---------------------------------------------------------------------------
# __main__ entrypoint
# ---------------------------------------------------------------------------

def test_main_entrypoint_calls_uvicorn():
    """Running main.py as a script calls uvicorn.run with the correct args."""
    main_path = str(pathlib.Path(__file__).parent.parent / "main.py")

    with patch("uvicorn.run") as mock_run:
        runpy.run_path(main_path, run_name="__main__")

    mock_run.assert_called_once_with(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
