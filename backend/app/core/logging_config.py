"""
Logging configuration for the GraphSense backend
"""

import logging
import logging.config
import sys
from typing import Dict, Any
from pythonjsonlogger import jsonlogger

def setup_logging(log_level: str = "info", log_format: str = "json") -> None:
    """
    Setup logging configuration

    Args:
        log_level: Logging level (debug, info, warning, error, critical)
        log_format: Logging format (json, text)
    """

    level = getattr(logging, log_level.upper(), logging.INFO)

    if log_format.lower() == "json":
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(level)

    # Configure root logger
    logging.basicConfig(
        level=level,
        handlers=[console_handler],
        force=True
    )

    # Set specific loggers
    loggers = [
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "fastapi",
        "app"
    ]

    for logger_name in loggers:
        logger = logging.getLogger(logger_name)
        logger.setLevel(level)
        logger.handlers = [console_handler]
        logger.propagate = False

def get_logger(name: str) -> logging.Logger:
    """Get a logger instance"""
    return logging.getLogger(name)