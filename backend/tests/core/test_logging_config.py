"""
Tests for app/core/logging_config.py
"""

import logging

from app.core.logging_config import get_logger, setup_logging


def test_setup_logging_json_format():
    setup_logging(log_level="info", log_format="json")
    root = logging.getLogger()
    assert root.level == logging.INFO


def test_setup_logging_text_format():
    setup_logging(log_level="debug", log_format="text")
    root = logging.getLogger()
    assert root.level == logging.DEBUG


def test_setup_logging_configures_named_loggers():
    setup_logging(log_level="warning", log_format="json")
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi", "app"):
        logger = logging.getLogger(name)
        assert logger.level == logging.WARNING
        assert not logger.propagate


def test_get_logger_returns_logger_with_correct_name():
    logger = get_logger("test.module")
    assert isinstance(logger, logging.Logger)
    assert logger.name == "test.module"
