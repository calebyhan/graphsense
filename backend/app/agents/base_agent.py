"""
Base agent class with Gemini integration
"""

import json
import logging
import re
import time
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import google.generativeai as genai
from google.generativeai.types import GenerationConfig

from app.core.config import get_settings
from app.models.base import AgentType

logger = logging.getLogger(__name__)
settings = get_settings()


class GeminiAgentConfig:
    """Configuration for Gemini API integration"""

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self.temperature = settings.gemini_temperature
        self.max_tokens = settings.gemini_max_tokens

        # Configure Gemini API
        genai.configure(api_key=self.api_key)


class BaseAgent(ABC):
    """Base class for all AI agents"""

    def __init__(self, agent_type: AgentType, config: Optional[GeminiAgentConfig] = None):
        self.agent_type = agent_type
        self.config = config or GeminiAgentConfig()
        self.model = genai.GenerativeModel(self.config.model)
        self.logger = logging.getLogger(f"{__name__}.{agent_type.value}")

    async def generate_response(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
        system_instruction: Optional[str] = None
    ) -> str:
        """Generate response using Gemini API"""
        try:
            start_time = time.time()

            # Prepare the full prompt
            full_prompt = self._prepare_prompt(prompt, context, system_instruction)

            # Generate response
            response = await self.model.generate_content_async(
                full_prompt,
                generation_config=GenerationConfig(
                    temperature=self.config.temperature,
                    max_output_tokens=self.config.max_tokens
                )
            )

            processing_time = int((time.time() - start_time) * 1000)
            self.logger.info(f"Generated response in {processing_time}ms")

            return response.text

        except Exception as e:
            self.logger.error(f"Failed to generate response: {e}")
            raise

    def _prepare_prompt(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
        system_instruction: Optional[str] = None
    ) -> str:
        """Prepare the complete prompt with context and instructions"""
        full_prompt = []

        if system_instruction:
            full_prompt.append(f"SYSTEM: {system_instruction}")

        if context:
            full_prompt.append("CONTEXT:")
            for key, value in context.items():
                full_prompt.append(f"{key}: {value}")

        full_prompt.append(f"TASK: {prompt}")

        return "\n\n".join(full_prompt)

    def extract_json_from_response(self, response: str) -> Dict[str, Any]:
        """Extract JSON from AI response that might contain extra text"""
        try:
            # First try to parse the entire response as JSON
            return json.loads(response)
        except json.JSONDecodeError:
            pass
        
        # Try to find JSON in the response using regex
        json_patterns = [
            r'```json\s*(\{.*?\})\s*```',  # JSON code blocks
            r'```\s*(\{.*?\})\s*```',      # Code blocks without json tag
            r'(\{.*\})',                    # Any text that looks like JSON
        ]
        
        for pattern in json_patterns:
            matches = re.findall(pattern, response, re.DOTALL)
            for match in matches:
                try:
                    return json.loads(match.strip())
                except json.JSONDecodeError:
                    continue
        
        # If no JSON found, return empty dict
        self.logger.warning(f"Could not extract valid JSON from response: {response[:200]}...")
        return {}

    @abstractmethod
    async def analyze(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Abstract method for agent analysis"""
        pass

    def _validate_input(self, data: Dict[str, Any]) -> bool:
        """Validate input data"""
        return data is not None and len(data) > 0

    def _format_output(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Format agent output with metadata"""
        return {
            "agent_type": self.agent_type.value,
            "result": result,
            "timestamp": time.time(),
            "model": self.config.model
        }