"""
Gemini AI Service - Centralized AI integration for all agents
"""

import logging
import hashlib
import json
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from google import genai
from google.genai import types
from cachetools import TTLCache

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GeminiAIService:
    """
    Centralized service for Gemini AI integration with caching and error handling.
    Provides AI capabilities to all agents with fallback mechanisms.
    """

    def __init__(self):
        # Initialize client with API key
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self._generation_config = types.GenerateContentConfig(
            temperature=settings.gemini_temperature,
            max_output_tokens=settings.gemini_max_tokens,
        )
        
        # Response cache with TTL (1 hour)
        self.response_cache = TTLCache(maxsize=1000, ttl=3600)
        
        # Rate limiting
        self.last_request_time = None
        self.min_request_interval = 1.0  # 1 second between requests
        
        logger.info("Gemini AI Service initialized")

    async def generate_data_profile_insights(
        self, 
        statistical_summary: Dict[str, Any],
        correlations: List[Dict[str, Any]],
        patterns: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate AI insights for data profiling.
        
        Args:
            statistical_summary: Basic statistical analysis
            correlations: Correlation analysis results
            patterns: Pattern analysis results
            
        Returns:
            AI-generated insights and recommendations
        """
        try:
            prompt = self._build_profiler_prompt(statistical_summary, correlations, patterns)
            cache_key = self._generate_cache_key("profiler", prompt)
            
            # Check cache first
            if cache_key in self.response_cache:
                logger.debug("Using cached profiler insights")
                return self.response_cache[cache_key]
            
            # Generate AI response
            response = await self._generate_with_retry(prompt)
            insights = self._parse_profiler_response(response)
            
            # Cache the response
            self.response_cache[cache_key] = insights
            
            return insights
            
        except Exception as e:
            logger.error(f"AI profiler insights failed: {e}")
            return self._get_profiler_fallback()

    async def generate_chart_recommendations(
        self, 
        data_profile: Dict[str, Any],
        column_types: Dict[str, str],
        correlations: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Generate AI-powered chart recommendations.
        
        Args:
            data_profile: Data profiling results
            column_types: Column type information
            correlations: Correlation analysis
            
        Returns:
            List of AI-recommended charts with reasoning
        """
        try:
            prompt = self._build_recommender_prompt(data_profile, column_types, correlations)
            cache_key = self._generate_cache_key("recommender", prompt)
            
            # Check cache first
            if cache_key in self.response_cache:
                logger.debug("Using cached chart recommendations")
                return self.response_cache[cache_key]
            
            # Generate AI response
            response = await self._generate_with_retry(prompt)
            recommendations = self._parse_recommender_response(response)
            
            # Cache the response
            self.response_cache[cache_key] = recommendations
            
            return recommendations
            
        except Exception as e:
            logger.error(f"AI chart recommendations failed: {e}")
            return self._get_recommender_fallback(column_types)

    async def validate_chart_recommendations(
        self, 
        recommendations: List[Dict[str, Any]],
        data_characteristics: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Generate AI-powered validation and scoring for chart recommendations.
        
        Args:
            recommendations: Chart recommendations to validate
            data_characteristics: Data characteristics for validation
            
        Returns:
            Validation scores and improvements
        """
        try:
            prompt = self._build_validator_prompt(recommendations, data_characteristics)
            cache_key = self._generate_cache_key("validator", prompt)
            
            # Check cache first
            if cache_key in self.response_cache:
                logger.debug("Using cached validation results")
                return self.response_cache[cache_key]
            
            # Generate AI response
            response = await self._generate_with_retry(prompt)
            validations = self._parse_validator_response(response)
            
            # Cache the response
            self.response_cache[cache_key] = validations
            
            return validations
            
        except Exception as e:
            logger.error(f"AI validation failed: {e}")
            return self._get_validator_fallback(recommendations)

    async def _generate_with_retry(self, prompt: str, max_retries: int = 3) -> str:
        """Generate response with retry logic and rate limiting"""
        
        for attempt in range(max_retries):
            try:
                # Rate limiting
                await self._rate_limit()
                
                # Generate response
                response = await asyncio.wait_for(
                    self.client.aio.models.generate_content(
                        model=settings.gemini_model,
                        contents=prompt,
                        config=self._generation_config,
                    ),
                    timeout=30.0  # 30 second timeout
                )

                return response.text
                
            except asyncio.TimeoutError:
                logger.warning(f"AI request timeout (attempt {attempt + 1})")
                if attempt == max_retries - 1:
                    raise Exception("AI request timed out after retries")
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
                
            except Exception as e:
                logger.warning(f"AI request failed (attempt {attempt + 1}): {e}")
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

    async def _rate_limit(self):
        """Simple rate limiting"""
        if self.last_request_time:
            elapsed = datetime.now().timestamp() - self.last_request_time
            if elapsed < self.min_request_interval:
                await asyncio.sleep(self.min_request_interval - elapsed)
        
        self.last_request_time = datetime.now().timestamp()

    def _generate_cache_key(self, agent_type: str, prompt: str) -> str:
        """Generate cache key from prompt hash"""
        prompt_hash = hashlib.md5(prompt.encode(), usedforsecurity=False).hexdigest()
        return f"{agent_type}_{prompt_hash}"

    def _build_profiler_prompt(
        self, 
        statistical_summary: Dict[str, Any],
        correlations: List[Dict[str, Any]],
        patterns: Dict[str, Any]
    ) -> str:
        """Build prompt for data profiler AI insights"""
        return f"""
You are a data analysis expert. Analyze this dataset and provide insights.

Dataset Summary:
- Rows: {statistical_summary.get('row_count', 0)}
- Columns: {statistical_summary.get('column_count', 0)}

Column Information:
{json.dumps(statistical_summary.get('columns', {}), indent=2)[:1000]}

Correlations Found:
{json.dumps(correlations[:5], indent=2)[:500]}

Patterns Detected:
{json.dumps(patterns, indent=2)[:500]}

Please provide:
1. Key insights about the data quality and characteristics
2. Notable patterns or anomalies
3. Suggestions for data preparation or cleaning
4. Potential analysis opportunities

Respond in JSON format:
{{
    "insights": ["insight1", "insight2", ...],
    "data_quality_score": 0.0-1.0,
    "recommended_actions": ["action1", "action2", ...],
    "analysis_opportunities": ["opportunity1", "opportunity2", ...]
}}
"""

    def _build_recommender_prompt(
        self, 
        data_profile: Dict[str, Any],
        column_types: Dict[str, str],
        correlations: List[Dict[str, Any]]
    ) -> str:
        """Build prompt for chart recommendation AI"""
        return f"""
You are a data visualization expert. Recommend the best charts for this dataset.

Dataset Profile:
- Rows: {data_profile.get('row_count', 0)}
- Columns: {data_profile.get('column_count', 0)}

Column Types:
{json.dumps(column_types, indent=2)}

Strong Correlations:
{json.dumps(correlations[:3], indent=2)[:300]}

Available Chart Types: bar, line, scatter, pie, histogram, box_plot, heatmap, area

Please recommend 3-5 charts that would be most effective for this data.

Respond in JSON format:
{{
    "recommendations": [
        {{
            "chart_type": "chart_type",
            "confidence": 0.0-1.0,
            "reasoning": "why this chart is good",
            "best_for": ["purpose1", "purpose2"],
            "x_axis": "column_name",
            "y_axis": "column_name",
            "color": "column_name or null"
        }}
    ]
}}
"""

    def _build_validator_prompt(
        self, 
        recommendations: List[Dict[str, Any]],
        data_characteristics: Dict[str, Any]
    ) -> str:
        """Build prompt for validation AI"""
        return f"""
You are a data visualization expert. Validate and score these chart recommendations.

Chart Recommendations:
{json.dumps(recommendations[:3], indent=2)[:800]}

Data Characteristics:
{json.dumps(data_characteristics, indent=2)[:400]}

Evaluate each recommendation on:
1. Data appropriateness (0.0-1.0)
2. Visual clarity (0.0-1.0)
3. Accessibility (0.0-1.0)
4. Overall effectiveness (0.0-1.0)

Respond in JSON format:
{{
    "validations": [
        {{
            "chart_type": "chart_type",
            "scores": {{
                "data_appropriateness": 0.0-1.0,
                "visual_clarity": 0.0-1.0,
                "accessibility": 0.0-1.0,
                "overall": 0.0-1.0
            }},
            "improvements": ["suggestion1", "suggestion2"],
            "final_score": 0.0-1.0
        }}
    ]
}}
"""

    def _parse_profiler_response(self, response: str) -> Dict[str, Any]:
        """Parse AI response for profiler insights"""
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                # Fallback parsing
                return {
                    "insights": [response[:200]],
                    "data_quality_score": 0.7,
                    "recommended_actions": ["Review data quality"],
                    "analysis_opportunities": ["Explore correlations"]
                }
        except Exception as e:
            logger.warning(f"Failed to parse profiler response: {e}")
            return self._get_profiler_fallback()

    def _parse_recommender_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse AI response for chart recommendations"""
        try:
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                return parsed.get("recommendations", [])
            else:
                return []
        except Exception as e:
            logger.warning(f"Failed to parse recommender response: {e}")
            return []

    def _parse_validator_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse AI response for validation results"""
        try:
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                return parsed.get("validations", [])
            else:
                return []
        except Exception as e:
            logger.warning(f"Failed to parse validator response: {e}")
            return []

    def _get_profiler_fallback(self) -> Dict[str, Any]:
        """Fallback insights when AI fails"""
        return {
            "insights": ["Basic statistical analysis completed"],
            "data_quality_score": 0.7,
            "recommended_actions": ["Review data for missing values"],
            "analysis_opportunities": ["Explore data relationships"]
        }

    def _get_recommender_fallback(self, column_types: Dict[str, str]) -> List[Dict[str, Any]]:
        """Fallback recommendations when AI fails"""
        recommendations = []
        
        numeric_cols = [col for col, dtype in column_types.items() if dtype == "numeric"]
        categorical_cols = [col for col, dtype in column_types.items() if dtype == "categorical"]
        
        if categorical_cols and numeric_cols:
            recommendations.append({
                "chart_type": "bar",
                "confidence": 0.7,
                "reasoning": "Good for comparing categories with numeric values",
                "best_for": ["comparison", "categorical_analysis"],
                "x_axis": categorical_cols[0],
                "y_axis": numeric_cols[0],
                "color": None
            })
        
        if len(numeric_cols) >= 2:
            recommendations.append({
                "chart_type": "scatter",
                "confidence": 0.6,
                "reasoning": "Useful for exploring relationships between numeric variables",
                "best_for": ["correlation", "relationship_analysis"],
                "x_axis": numeric_cols[0],
                "y_axis": numeric_cols[1],
                "color": categorical_cols[0] if categorical_cols else None
            })
        
        return recommendations

    def _get_validator_fallback(self, recommendations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Fallback validation when AI fails"""
        validations = []
        
        for rec in recommendations:
            validations.append({
                "chart_type": rec.get("chart_type", "bar"),
                "scores": {
                    "data_appropriateness": 0.7,
                    "visual_clarity": 0.7,
                    "accessibility": 0.6,
                    "overall": 0.7
                },
                "improvements": ["Consider adding clear labels"],
                "final_score": 0.7
            })
        
        return validations

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics for monitoring"""
        return {
            "cache_size": len(self.response_cache),
            "cache_maxsize": self.response_cache.maxsize,
            "cache_ttl": self.response_cache.ttl
        }


# Global instance
_gemini_service: Optional[GeminiAIService] = None


def get_gemini_service() -> GeminiAIService:
    """Get or create global Gemini AI service instance"""
    global _gemini_service
    
    if _gemini_service is None:
        _gemini_service = GeminiAIService()
    
    return _gemini_service
