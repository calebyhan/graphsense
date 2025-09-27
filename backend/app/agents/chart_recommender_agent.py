"""
Chart Recommender Agent - Evaluates ALL 10 chart types and provides recommendations
"""

import json
import logging
from typing import Dict, Any, List
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

logger = logging.getLogger(__name__)


class ChartRecommenderAgent(BaseAgent):
    """Agent that evaluates all chart types and provides intelligent recommendations"""

    def __init__(self):
        super().__init__(AgentType.RECOMMENDER)
        self.chart_types = [chart_type.value for chart_type in ChartType]

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

    async def _generate_chart_recommendations(
        self,
        analysis: ComprehensiveDataAnalysis
    ) -> Dict[str, Any]:
        """Generate chart recommendations using Gemini AI"""

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

        response = await self.generate_response(
            prompt,
            system_instruction="You are an expert data visualization consultant. Evaluate ALL 10 chart types and provide detailed analysis in valid JSON format."
        )

        # Use the base agent's JSON extraction method
        json_response = self.extract_json_from_response(response)
        
        if not json_response:
            logger.error("Failed to parse AI response as JSON, using fallback")
            # Fallback to rule-based recommendations
            return self._fallback_recommendations(analysis)
            
        return json_response

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