"""
Chart Recommender Agent - Evaluates ALL 10 chart types and provides recommendations
"""

import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from .base_agent import BaseAgent
from app.models.base import AgentType, ChartType
from app.models.analysis import (
    ChartRecommendation,
    DataMapping,
    AgentReasoning,
    InteractionConfig,
    ComprehensiveDataAnalysis
)
from app.models.processing_context import ProcessingContext
from app.utils.intelligent_cache import get_intelligent_cache

logger = logging.getLogger(__name__)


class ChartRecommenderAgent(BaseAgent):
    """Agent that evaluates all chart types and provides intelligent recommendations"""

    def __init__(self):
        super().__init__(AgentType.RECOMMENDER)
        self.chart_types = [chart_type.value for chart_type in ChartType]
        self.cache = get_intelligent_cache()

    async def recommend(
        self,
        analysis: ComprehensiveDataAnalysis
    ) -> List[ChartRecommendation]:
        """Generate chart recommendations based on comprehensive data analysis"""
        try:
            start_time = datetime.now()

            # Generate recommendations using AI
            recommendations_data = await self._generate_chart_recommendations(analysis)

            # Parse and validate recommendations
            recommendations = self._parse_recommendations(recommendations_data, analysis)

            # Add processing time
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            for rec in recommendations:
                rec.reasoning.append(AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning="Chart recommendation generated using AI analysis",
                    confidence=rec.confidence,
                    evidence=[],
                    processing_time_ms=processing_time
                ))

            # Sort by confidence and return top 5
            recommendations.sort(key=lambda x: x.confidence, reverse=True)
            return recommendations[:5]

        except Exception as e:
            logger.error(f"Chart recommendation failed: {e}")
            raise

    async def recommend_with_context(
        self,
        context: ProcessingContext
    ) -> List[ChartRecommendation]:
        """
        Generate chart recommendations using shared processing context.
        This method leverages cached analysis results to avoid redundant computations.
        """
        try:
            start_time = datetime.now()
            
            logger.info(f"Starting context-aware chart recommendations for dataset {context.dataset_id}")

            # Use cached profiler results if available
            if context.profiler_results:
                logger.info("Using cached profiler results for recommendations")
                analysis = context.profiler_results
            else:
                # This shouldn't happen in normal flow, but handle gracefully
                logger.warning("No cached profiler results found, cannot generate recommendations")
                raise ValueError("ProcessingContext must contain profiler results")

            # Generate recommendations using cached data
            recommendations_data = await self._generate_chart_recommendations_with_context(analysis, context)

            # Parse and validate recommendations
            recommendations = self._parse_recommendations(recommendations_data, analysis)

            # Add processing time
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            for rec in recommendations:
                rec.reasoning.append(AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning="Chart recommendation generated using cached analysis data",
                    confidence=rec.confidence,
                    evidence=[],
                    processing_time_ms=processing_time
                ))

            # Sort by confidence and return top 5
            recommendations.sort(key=lambda x: x.confidence, reverse=True)
            
            logger.info(f"Context-aware recommendations completed in {processing_time}ms")
            return recommendations[:5]

        except Exception as e:
            logger.error(f"Context-aware chart recommendation failed: {e}")
            raise

    async def _generate_chart_recommendations(
        self,
        analysis: ComprehensiveDataAnalysis
    ) -> Dict[str, Any]:
        """Generate chart recommendations using Gemini AI with caching"""

        # Prepare data summary for AI
        data_summary = {
            "columns": analysis.statistical_summary.get("columns", {}),
            "correlations": analysis.correlations,
            "patterns": analysis.patterns,
            "data_quality": analysis.data_quality,
            "row_count": analysis.statistical_summary.get("row_count", 0),
            "column_count": analysis.statistical_summary.get("column_count", 0)
        }

        prompt = f"""
        As a data visualization expert, analyze this dataset and recommend the best chart types from ALL available options.

        Dataset Analysis:
        {json.dumps(data_summary, default=str, indent=2)}

        Available Chart Types:
        1. bar - For comparing categorical data
        2. line - For showing trends over time or continuous data
        3. scatter - For showing relationships between two continuous variables
        4. pie - For showing parts of a whole (use sparingly)
        5. histogram - For showing distribution of a single continuous variable
        6. box_plot - For showing distribution with quartiles and outliers
        7. heatmap - For showing correlation matrices or 2D data patterns
        8. area - For showing cumulative data or stacked categories over time
        9. treemap - For hierarchical data with size-based comparison
        10. sankey - For flow data showing connections between categories

        For EACH of the 10 chart types, provide:
        1. Suitability score (0.0-1.0) based on the data characteristics
        2. Reasoning for why this chart type is/isn't suitable
        3. Suggested data mapping (which columns to use for x, y, color, etc.)
        4. Confidence score (0.0-1.0) for this recommendation

        Respond in JSON format:
        {{
            "recommendations": [
                {{
                    "chart_type": "bar",
                    "suitability_score": 0.85,
                    "confidence": 0.90,
                    "reasoning": "Detailed explanation...",
                    "data_mapping": {{
                        "x_axis": "column_name",
                        "y_axis": "column_name",
                        "color": "optional_column",
                        "size": null,
                        "facet": null
                    }},
                    "styling_suggestions": {{
                        "color_scheme": "categorical",
                        "title": "Suggested chart title",
                        "description": "Brief description"
                    }}
                }},
                ... (repeat for all 10 chart types)
            ]
        }}
        """

        # Generate prompt hash for caching
        prompt_hash = self.cache.generate_prompt_hash(prompt, data_summary)
        
        # Check cache first
        cached_response = self.cache.get_cached_ai_response(prompt_hash)
        if cached_response:
            logger.debug(f"Using cached chart recommendations for prompt hash: {prompt_hash}")
            return cached_response

        # Generate new response
        response = await self.generate_response(
            prompt,
            system_instruction="You are an expert data visualization consultant. Evaluate ALL 10 chart types and provide detailed analysis in valid JSON format."
        )

        # Use the base agent's JSON extraction method
        json_response = self.extract_json_from_response(response)
        
        if json_response:
            # Cache the successful response
            self.cache.cache_ai_response(prompt_hash, json_response)
            logger.debug(f"Cached chart recommendations for prompt hash: {prompt_hash}")
            return json_response
        else:
            logger.error("Failed to parse AI response as JSON, using fallback")
            # Fallback to rule-based recommendations
            fallback_response = self._fallback_recommendations(analysis)
            
            # Cache the fallback response to avoid repeated failures
            self.cache.cache_ai_response(prompt_hash, fallback_response)
            
            return fallback_response

    async def _generate_chart_recommendations_with_context(
        self,
        analysis: ComprehensiveDataAnalysis,
        context: ProcessingContext
    ) -> Dict[str, Any]:
        """Generate chart recommendations using cached context data"""

        # Use cached statistical summaries and metadata from context
        data_summary = {
            "columns": context.column_metadata,  # Use cached column metadata
            "correlations": context.get_cached_statistic("correlations") or analysis.correlations,
            "patterns": context.get_cached_statistic("patterns") or analysis.patterns,
            "data_quality": context.get_cached_statistic("data_quality") or analysis.data_quality,
            "row_count": len(context.sample_data),
            "column_count": len(context.sample_data.columns),
            "numeric_columns": context.get_numeric_columns(),
            "categorical_columns": context.get_categorical_columns(),
            "temporal_columns": context.get_temporal_columns()
        }

        prompt = f"""
        As a data visualization expert, analyze this dataset and recommend the best chart types from ALL available options.

        Dataset Analysis (using cached computations):
        {json.dumps(data_summary, default=str, indent=2)}

        Available Chart Types:
        1. bar - For comparing categorical data
        2. line - For showing trends over time or continuous data
        3. scatter - For showing relationships between two continuous variables
        4. pie - For showing parts of a whole (use sparingly)
        5. histogram - For showing distribution of a single continuous variable
        6. box_plot - For showing distribution with quartiles and outliers
        7. heatmap - For showing correlation matrices or 2D data patterns
        8. area - For showing cumulative data or stacked categories over time
        9. treemap - For hierarchical data with size-based comparison
        10. sankey - For flow data showing connections between categories

        For EACH of the 10 chart types, provide:
        1. Suitability score (0.0-1.0) based on the data characteristics
        2. Reasoning for why this chart type is/isn't suitable
        3. Suggested data mapping (which columns to use for x, y, color, etc.)
        4. Confidence score (0.0-1.0) for this recommendation

        Respond in JSON format:
        {{
            "recommendations": [
                {{
                    "chart_type": "bar",
                    "suitability_score": 0.85,
                    "confidence": 0.90,
                    "reasoning": "Detailed explanation...",
                    "data_mapping": {{
                        "x_axis": "column_name",
                        "y_axis": "column_name",
                        "color": "optional_column",
                        "size": null,
                        "facet": null
                    }},
                    "styling_suggestions": {{
                        "color_scheme": "categorical",
                        "title": "Suggested chart title",
                        "description": "Brief description"
                    }}
                }},
                ... (repeat for all 10 chart types)
            ]
        }}
        """

        # Generate prompt hash for caching (include context info)
        context_info = {
            "dataset_id": context.dataset_id,
            "sample_size": len(context.sample_data),
            "column_types": {col: meta.get("data_type") for col, meta in context.column_metadata.items()}
        }
        prompt_hash = self.cache.generate_prompt_hash(prompt, context_info)
        
        # Check cache first
        cached_response = self.cache.get_cached_ai_response(prompt_hash)
        if cached_response:
            logger.debug(f"Using cached chart recommendations for context-aware prompt hash: {prompt_hash}")
            return cached_response

        # Generate new response
        response = await self.generate_response(
            prompt,
            system_instruction="You are an expert data visualization consultant. Evaluate ALL 10 chart types and provide detailed analysis in valid JSON format."
        )

        # Use the base agent's JSON extraction method
        json_response = self.extract_json_from_response(response)
        
        if json_response:
            # Cache the successful response
            self.cache.cache_ai_response(prompt_hash, json_response)
            logger.debug(f"Cached context-aware chart recommendations for prompt hash: {prompt_hash}")
            return json_response
        else:
            logger.error("Failed to parse AI response as JSON, using fallback")
            # Fallback to rule-based recommendations using context
            fallback_response = self._fallback_recommendations_with_context(context)
            
            # Cache the fallback response to avoid repeated failures
            self.cache.cache_ai_response(prompt_hash, fallback_response)
            
            return fallback_response

    def _parse_recommendations(
        self,
        recommendations_data: Dict[str, Any],
        analysis: ComprehensiveDataAnalysis
    ) -> List[ChartRecommendation]:
        """Parse AI recommendations into ChartRecommendation objects"""
        recommendations = []

        for rec_data in recommendations_data.get("recommendations", []):
            try:
                # Validate chart type
                chart_type_str = rec_data.get("chart_type")
                if chart_type_str not in [ct.value for ct in ChartType]:
                    continue

                chart_type = ChartType(chart_type_str)

                # Create data mapping
                mapping_data = rec_data.get("data_mapping", {})
                data_mapping = DataMapping(
                    x_axis=mapping_data.get("x_axis"),
                    y_axis=mapping_data.get("y_axis"),
                    color=mapping_data.get("color"),
                    size=mapping_data.get("size"),
                    facet=mapping_data.get("facet"),
                    additional_dimensions=mapping_data.get("additional_dimensions", {})
                )

                # Create reasoning
                reasoning = [AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=rec_data.get("reasoning", "AI-generated recommendation"),
                    confidence=float(rec_data.get("confidence", 0.5)),
                    evidence=[]
                )]

                # Create interaction config based on chart type
                interaction_config = self._get_interaction_config(chart_type)

                # Create recommendation
                recommendation = ChartRecommendation(
                    chart_type=chart_type,
                    confidence=float(rec_data.get("confidence", 0.5)),
                    data_mapping=data_mapping,
                    reasoning=reasoning,
                    interaction_config=interaction_config,
                    styling_suggestions=rec_data.get("styling_suggestions", {}),
                    suitability_score=float(rec_data.get("suitability_score", 0.5))
                )

                recommendations.append(recommendation)

            except Exception as e:
                logger.warning(f"Failed to parse recommendation: {e}")
                continue

        return recommendations

    def _fallback_recommendations(
        self,
        analysis: ComprehensiveDataAnalysis
    ) -> Dict[str, Any]:
        """Fallback rule-based recommendations when AI parsing fails"""
        columns = analysis.statistical_summary.get("columns", {})
        numeric_cols = [name for name, info in columns.items()
                       if info.get("data_type") == "numeric"]
        categorical_cols = [name for name, info in columns.items()
                           if info.get("data_type") == "categorical"]
        temporal_cols = [name for name, info in columns.items()
                        if info.get("data_type") == "temporal"]

        recommendations = []

        # Rule-based recommendations for each chart type
        if len(categorical_cols) > 0 and len(numeric_cols) > 0:
            # Bar chart
            recommendations.append({
                "chart_type": "bar",
                "suitability_score": 0.8,
                "confidence": 0.9,
                "reasoning": "Good categorical vs numeric comparison",
                "data_mapping": {
                    "x_axis": categorical_cols[0],
                    "y_axis": numeric_cols[0],
                    "color": categorical_cols[1] if len(categorical_cols) > 1 else None
                }
            })

        if len(temporal_cols) > 0 and len(numeric_cols) > 0:
            # Line chart
            recommendations.append({
                "chart_type": "line",
                "suitability_score": 0.9,
                "confidence": 0.95,
                "reasoning": "Excellent for temporal trends",
                "data_mapping": {
                    "x_axis": temporal_cols[0],
                    "y_axis": numeric_cols[0]
                }
            })

        if len(numeric_cols) >= 2:
            # Scatter plot
            recommendations.append({
                "chart_type": "scatter",
                "suitability_score": 0.7,
                "confidence": 0.8,
                "reasoning": "Good for exploring relationships between numeric variables",
                "data_mapping": {
                    "x_axis": numeric_cols[0],
                    "y_axis": numeric_cols[1],
                    "color": categorical_cols[0] if categorical_cols else None
                }
            })

        # Add more fallback rules for other chart types...
        # This is a simplified version

        return {"recommendations": recommendations}

    def _fallback_recommendations_with_context(
        self,
        context: ProcessingContext
    ) -> Dict[str, Any]:
        """Fallback rule-based recommendations using processing context"""
        numeric_cols = context.get_numeric_columns()
        categorical_cols = context.get_categorical_columns()
        temporal_cols = context.get_temporal_columns()

        recommendations = []

        # Rule-based recommendations for each chart type using cached metadata
        if len(categorical_cols) > 0 and len(numeric_cols) > 0:
            # Bar chart
            recommendations.append({
                "chart_type": "bar",
                "suitability_score": 0.8,
                "confidence": 0.9,
                "reasoning": "Good categorical vs numeric comparison (using cached metadata)",
                "data_mapping": {
                    "x_axis": categorical_cols[0],
                    "y_axis": numeric_cols[0],
                    "color": categorical_cols[1] if len(categorical_cols) > 1 else None
                }
            })

        if len(temporal_cols) > 0 and len(numeric_cols) > 0:
            # Line chart
            recommendations.append({
                "chart_type": "line",
                "suitability_score": 0.9,
                "confidence": 0.95,
                "reasoning": "Excellent for temporal trends (using cached metadata)",
                "data_mapping": {
                    "x_axis": temporal_cols[0],
                    "y_axis": numeric_cols[0]
                }
            })

        if len(numeric_cols) >= 2:
            # Scatter plot
            recommendations.append({
                "chart_type": "scatter",
                "suitability_score": 0.7,
                "confidence": 0.8,
                "reasoning": "Good for exploring relationships between numeric variables (using cached metadata)",
                "data_mapping": {
                    "x_axis": numeric_cols[0],
                    "y_axis": numeric_cols[1],
                    "color": categorical_cols[0] if categorical_cols else None
                }
            })

        # Add more fallback rules for other chart types...
        # This is a simplified version

        return {"recommendations": recommendations}

    def _get_interaction_config(self, chart_type: ChartType) -> InteractionConfig:
        """Get appropriate interaction configuration for chart type"""
        config_map = {
            ChartType.BAR: InteractionConfig(zoom_enabled=False, pan_enabled=False),
            ChartType.LINE: InteractionConfig(zoom_enabled=True, pan_enabled=True),
            ChartType.SCATTER: InteractionConfig(zoom_enabled=True, pan_enabled=True, selection_enabled=True),
            ChartType.PIE: InteractionConfig(zoom_enabled=False, pan_enabled=False),
            ChartType.HISTOGRAM: InteractionConfig(zoom_enabled=True, pan_enabled=False),
            ChartType.BOX_PLOT: InteractionConfig(zoom_enabled=False, pan_enabled=False),
            ChartType.HEATMAP: InteractionConfig(zoom_enabled=True, pan_enabled=True),
            ChartType.AREA: InteractionConfig(zoom_enabled=True, pan_enabled=True),
            ChartType.TREEMAP: InteractionConfig(zoom_enabled=False, pan_enabled=False),
            ChartType.SANKEY: InteractionConfig(zoom_enabled=False, pan_enabled=False)
        }

        return config_map.get(chart_type, InteractionConfig())

    async def analyze(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Implement abstract analyze method"""
        # For the ChartRecommenderAgent, this method can delegate to recommend
        # when given appropriate data structure
        if "analysis" in data:
            recommendations = await self.recommend(data["analysis"])
            return {
                "recommendations": [rec.dict() for rec in recommendations],
                "agent_type": self.agent_type.value
            }
        else:
            raise ValueError("ChartRecommenderAgent requires 'analysis' in input data")