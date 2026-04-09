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
            logger.error(f"AI profiler insights failed: {e}", exc_info=True)
            return self._get_profiler_fallback()

    async def generate_chart_recommendations(
        self,
        dataset_context: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Generate AI-powered chart recommendations.

        Args:
            dataset_context: Enriched dataset context including column names, types,
                             sample values, numeric stats, and correlations.

        Returns:
            List of AI-recommended charts with reasoning
        """
        try:
            prompt = self._build_recommender_prompt(dataset_context)
            cache_key = self._generate_cache_key("recommender", prompt)

            # Check cache first
            if cache_key in self.response_cache:
                logger.debug("Using cached chart recommendations")
                return self.response_cache[cache_key]

            # Generate AI response
            response = await self._generate_with_retry(prompt)
            recommendations = self._parse_recommender_response(response)

            # Only cache non-empty results — an empty list may indicate a transient
            # parse failure, and caching it would serve zero recommendations for 1 hour.
            if recommendations:
                self.response_cache[cache_key] = recommendations

            return recommendations

        except Exception as e:
            logger.error(
                f"AI chart recommendations failed, returning static fallback: {e}",
                exc_info=True,
            )
            fallback = self._get_recommender_fallback(dataset_context)
            for rec in fallback:
                rec["_source"] = "fallback"
            return fallback

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
            logger.error(f"AI validation failed: {e}", exc_info=True)
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
        # Build a compact column summary: for each column keep only the fields most
        # useful to a data-quality analyst (type, null%, unique count, and a handful
        # of representative stats).  This keeps the prompt focused and avoids the
        # hard 1000-char truncation that cut off all but the first few columns.
        compact_cols = {}
        for col_name, col_info in (statistical_summary.get("columns") or {}).items():
            dtype = col_info.get("data_type") or col_info.get("analysis_type", "unknown")
            entry: Dict[str, Any] = {
                "type": dtype,
                "null_pct": round(col_info.get("null_percentage", 0), 1),
                "unique": col_info.get("unique_count"),
            }
            if col_info.get("mean") is not None:
                entry["mean"] = round(col_info["mean"], 3)
                entry["min"] = col_info.get("min")
                entry["max"] = col_info.get("max")
                entry["skewness"] = round(col_info.get("skewness", 0), 2) if col_info.get("skewness") is not None else None
            elif col_info.get("top_values"):
                top = list(col_info["top_values"].keys())[:5]
                entry["top_values"] = top
            compact_cols[col_name] = entry

        return f"""
You are a data analysis expert. Analyze this dataset and provide insights.

Dataset Summary:
- Rows: {statistical_summary.get('row_count', 0)}
- Columns: {statistical_summary.get('column_count', 0)}

Column Information:
{json.dumps(compact_cols, indent=2)[:3000]}

Correlations Found:
{json.dumps(correlations[:5], indent=2)[:800]}

Patterns Detected:
{json.dumps(patterns, indent=2)[:800]}

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

    def _build_recommender_prompt(self, dataset_context: Dict[str, Any]) -> str:
        """Build enriched prompt for chart recommendation AI"""
        row_count = dataset_context.get("row_count", 0)
        column_count = dataset_context.get("column_count", 0)

        # Prioritise temporal + numeric + categorical columns; cap at 30 to stay within token budget
        columns = dataset_context.get("columns", [])
        priority_order = {"temporal": 0, "numeric": 1, "categorical": 2, "text": 3}
        columns_sorted = sorted(columns, key=lambda c: priority_order.get(c.get("type", "text"), 3))
        if len(columns_sorted) > 30:
            logger.warning(f"Dataset has {len(columns_sorted)} columns; truncating to 30 for recommender prompt")
            columns_sorted = columns_sorted[:30]

        columns_json = json.dumps(columns_sorted, indent=2)
        correlations_json = json.dumps(dataset_context.get("strong_correlations", [])[:5], indent=2)

        return f"""
You are a data visualization expert. Recommend the best charts for this dataset.

Dataset overview:
- Rows: {row_count}
- Columns: {column_count}

Column details (name, type, sample values, statistics):
{columns_json}

Strong correlations detected:
{correlations_json}

Available chart types and when to use them:
- bar: compare a numeric measure across categories (≤20 categories), horizontal orientation
- column: same as bar but vertical orientation (categories on x-axis)
- line: show trends over time or ordered sequences
- area: show cumulative or stacked trends over time
- scatter: reveal relationships or correlations between two numeric columns
- pie: show part-to-whole proportions (2–8 categories only)
- histogram: show the distribution / frequency of a single numeric column
- box_plot: show distribution spread and outliers, optionally grouped by a category
- heatmap: show a numeric value across a row × column matrix (two categorical axes)
- treemap: show hierarchical proportions (one categorical + one numeric column)
- sankey: show flow or transitions between stages (two categorical columns + a weight)

Field mapping rules for advanced charts:
- heatmap: x_axis = column-dimension (categorical), color = row-dimension (categorical), y_axis = value (numeric)
- sankey: x_axis = source node (categorical), color = target node (categorical), y_axis = flow weight (numeric)
- treemap: x_axis = hierarchy/category field (categorical), y_axis = size value (numeric)
- box_plot: x_axis = grouping category (optional), y_axis = numeric value to distribute

Rules:
1. Only use column names that appear exactly in the column details above.
2. Prefer column pairs with strong correlations for scatter charts.
3. Prefer temporal columns for the x-axis of line and area charts.
4. Do not recommend pie if the category column has more than 8 unique values.
5. Recommend 3–5 charts. Avoid recommending the same chart type twice unless the column pairings are meaningfully different.
6. For heatmap and sankey, always populate x_axis, y_axis, AND color as described in the field mapping rules above.

Respond ONLY with valid JSON — no markdown fences, no extra text:
{{
    "recommendations": [
        {{
            "chart_type": "one of the types above",
            "confidence": 0.0-1.0,
            "reasoning": "one sentence explaining why this chart suits the data",
            "best_for": ["purpose1", "purpose2"],
            "x_axis": "exact column name or null",
            "y_axis": "exact column name or null",
            "color": "exact column name or null"
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
        # Build a compact but informative data summary to stay within token budget
        # while giving the model enough signal to score appropriateness accurately.
        profiler = data_characteristics.get("profiler_data") or {}
        correlations = data_characteristics.get("correlations") or []

        compact_cols = {}
        for col_name, col_info in (profiler.get("columns") or {}).items():
            dtype = col_info.get("data_type") or col_info.get("analysis_type", "unknown")
            entry: Dict[str, Any] = {"type": dtype, "unique": col_info.get("unique_count")}
            if col_info.get("mean") is not None:
                entry["mean"] = round(col_info["mean"], 3)
                entry["min"] = col_info.get("min")
                entry["max"] = col_info.get("max")
            elif col_info.get("top_values"):
                top = list(col_info["top_values"].keys())[:5]
                entry["top_values"] = top
            compact_cols[col_name] = entry

        compact_data = {
            "rows": profiler.get("row_count"),
            "columns": compact_cols,
            "strong_correlations": [
                {"col1": c["column1"], "col2": c["column2"], "r": round(c.get("correlation", 0), 3)}
                for c in correlations
                if abs(c.get("correlation", 0)) > 0.5
            ][:5],
        }

        # Slim down the recommendations to just the fields the model needs
        slim_recs = []
        for rec in recommendations[:5]:
            dm = rec.get("data_mapping") or {}
            slim_recs.append({
                "chart_type": rec.get("chart_type"),
                "confidence": rec.get("confidence"),
                "x_axis": dm.get("x_axis"),
                "y_axis": dm.get("y_axis"),
                "color": dm.get("color"),
                "reasoning": (rec.get("reasoning") or [{}])[0].get("reasoning", "") if isinstance(rec.get("reasoning"), list) else str(rec.get("reasoning", ""))[:100],
            })

        return f"""
You are a data visualization expert. Validate and score these chart recommendations against the dataset.

Chart Recommendations:
{json.dumps(slim_recs, indent=2)}

Dataset Summary:
{json.dumps(compact_data, indent=2)[:2000]}

Evaluate EACH recommendation on all four criteria:
1. data_appropriateness (0.0–1.0): Does this chart type suit the column types mapped to x/y/color?
2. visual_clarity (0.0–1.0): Will the chart be readable and interpretable?
3. accessibility (0.0–1.0): Is the chart type easy to understand for a general audience?
4. interactivity (0.0–1.0): Does this chart type support useful interactive exploration?

Respond ONLY with valid JSON — no markdown fences, no extra text:
{{
    "validations": [
        {{
            "chart_type": "chart_type",
            "scores": {{
                "data_appropriateness": 0.0-1.0,
                "visual_clarity": 0.0-1.0,
                "accessibility": 0.0-1.0,
                "interactivity": 0.0-1.0
            }},
            "improvements": ["suggestion1"],
            "final_score": 0.0-1.0
        }}
    ]
}}
"""

    @staticmethod
    def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
        """Extract the first complete JSON object from text using a non-greedy decoder.

        Uses json.JSONDecoder.raw_decode so that trailing prose (including curly
        braces in template strings like ``{column_name}``) does not cause the
        greedy ``r'\\{.*\\}'`` pattern to pick up the wrong span.  Returns None
        if no valid JSON object is found.
        """
        decoder = json.JSONDecoder()
        for i, char in enumerate(text):
            if char == '{':
                try:
                    obj, _ = decoder.raw_decode(text, i)
                    return obj
                except json.JSONDecodeError:
                    continue
        return None

    def _parse_profiler_response(self, response: str) -> Dict[str, Any]:
        """Parse AI response for profiler insights"""
        try:
            parsed = self._extract_json_object(response)
            if parsed is None:
                logger.error(
                    "AI profiler response contained no valid JSON object. "
                    f"Raw response (first 300 chars): {response[:300]!r}"
                )
                return self._get_profiler_fallback()
            return parsed
        except Exception as e:
            logger.error(f"Unexpected error parsing profiler response: {e}", exc_info=True)
            return self._get_profiler_fallback()

    def _parse_recommender_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse AI response for chart recommendations"""
        try:
            parsed = self._extract_json_object(response)
            if parsed is None:
                logger.error(
                    "AI recommender response contained no valid JSON object. "
                    f"Raw response (first 300 chars): {response[:300]!r}"
                )
                return []
            recs = parsed.get("recommendations")
            if recs is None:
                logger.error(
                    "AI recommender JSON missing 'recommendations' key. "
                    f"Top-level keys present: {list(parsed.keys())}"
                )
                return []
            if not recs:
                logger.warning("AI recommender returned an empty recommendations list")
            return recs
        except Exception as e:
            logger.error(f"Unexpected error parsing recommender response: {e}", exc_info=True)
            return []

    def _parse_validator_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse AI response for validation results"""
        try:
            parsed = self._extract_json_object(response)
            if parsed is None:
                logger.error(
                    "AI validator response contained no valid JSON object. "
                    f"Raw response (first 300 chars): {response[:300]!r}"
                )
                return []
            vals = parsed.get("validations")
            if vals is None:
                logger.error(
                    "AI validator JSON missing 'validations' key. "
                    f"Top-level keys present: {list(parsed.keys())}"
                )
                return []
            return vals
        except Exception as e:
            logger.error(f"Unexpected error parsing validator response: {e}", exc_info=True)
            return []

    def _get_profiler_fallback(self) -> Dict[str, Any]:
        """Fallback insights when AI fails"""
        return {
            "insights": ["Basic statistical analysis completed"],
            "data_quality_score": 0.7,
            "recommended_actions": ["Review data for missing values"],
            "analysis_opportunities": ["Explore data relationships"]
        }

    def _get_recommender_fallback(self, dataset_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Fallback recommendations when AI fails"""
        recommendations = []

        columns = dataset_context.get("columns", [])
        numeric_cols = [c["name"] for c in columns if c.get("type") == "numeric"]
        categorical_cols = [c["name"] for c in columns if c.get("type") == "categorical"]

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
                    "interactivity": 0.7
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
