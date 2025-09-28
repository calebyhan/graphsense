"""
Clean base agent architecture with single process() method and fallback mechanisms
"""

import logging
import time
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass

from app.models.base import AgentType
from app.models.processing_context import ProcessingContext

logger = logging.getLogger(__name__)


@dataclass
class AgentResult:
    """Standardized result from agent processing"""
    agent_type: AgentType
    success: bool
    data: Dict[str, Any]
    processing_time_ms: int
    confidence: float
    error_message: Optional[str] = None


class BaseAgent(ABC):
    """
    Clean base agent interface with single responsibility.
    All agents follow the same pattern: process(context) -> AgentResult
    """

    def __init__(self, agent_type: AgentType):
        self.agent_type = agent_type
        self.logger = logging.getLogger(f"{__name__}.{agent_type.value}")

    @abstractmethod
    async def process(self, context: ProcessingContext) -> AgentResult:
        """
        Single processing method for agent - to be implemented by subclasses.
        
        Args:
            context: ProcessingContext with shared data and caching
            
        Returns:
            AgentResult with processing outcome
        """
        pass

    def get_fallback_result(self, context: ProcessingContext, error: str = None) -> AgentResult:
        """
        Fallback mechanism when processing fails - to be overridden by subclasses.
        Provides rule-based alternatives when AI processing fails.
        """
        return AgentResult(
            agent_type=self.agent_type,
            success=False,
            data={},
            processing_time_ms=0,
            confidence=0.0,
            error_message=error or "Processing failed, no fallback implemented"
        )

    def validate_input(self, context: ProcessingContext) -> bool:
        """
        Input validation - can be overridden by subclasses.
        
        Args:
            context: ProcessingContext to validate
            
        Returns:
            True if input is valid, False otherwise
        """
        try:
            return (
                context is not None and 
                context.sample_data is not None and 
                not context.sample_data.empty
            )
        except Exception as e:
            self.logger.warning(f"Input validation failed: {e}")
            return False

    async def _safe_process(self, context: ProcessingContext) -> AgentResult:
        """
        Safe processing wrapper with error handling and fallbacks.
        This method handles the common error patterns and fallback logic.
        """
        start_time = datetime.now()
        
        try:
            # Validate input
            if not self.validate_input(context):
                self.logger.warning(f"{self.agent_type.value} agent received invalid input")
                return self.get_fallback_result(context, "Invalid input data")
            
            # Process with timeout and error handling
            result = await self.process(context)
            
            # Ensure result is properly formatted
            if not isinstance(result, AgentResult):
                self.logger.error(f"{self.agent_type.value} agent returned invalid result type")
                return self.get_fallback_result(context, "Invalid result format")
            
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            result.processing_time_ms = processing_time
            
            self.logger.info(f"{self.agent_type.value} agent completed successfully in {processing_time}ms")
            return result
            
        except Exception as e:
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            self.logger.error(f"{self.agent_type.value} agent failed: {e}")
            
            # Try fallback
            try:
                fallback_result = self.get_fallback_result(context, str(e))
                fallback_result.processing_time_ms = processing_time
                return fallback_result
            except Exception as fallback_error:
                self.logger.error(f"{self.agent_type.value} agent fallback also failed: {fallback_error}")
                return AgentResult(
                    agent_type=self.agent_type,
                    success=False,
                    data={},
                    processing_time_ms=processing_time,
                    confidence=0.0,
                    error_message=f"Both processing and fallback failed: {e}"
                )

    def _create_success_result(
        self, 
        data: Dict[str, Any], 
        confidence: float = 1.0,
        processing_time_ms: int = 0
    ) -> AgentResult:
        """Helper method to create successful AgentResult"""
        return AgentResult(
            agent_type=self.agent_type,
            success=True,
            data=data,
            processing_time_ms=processing_time_ms,
            confidence=max(0.0, min(1.0, confidence))  # Clamp between 0 and 1
        )

    def _create_error_result(
        self, 
        error_message: str, 
        processing_time_ms: int = 0
    ) -> AgentResult:
        """Helper method to create error AgentResult"""
        return AgentResult(
            agent_type=self.agent_type,
            success=False,
            data={},
            processing_time_ms=processing_time_ms,
            confidence=0.0,
            error_message=error_message
        )