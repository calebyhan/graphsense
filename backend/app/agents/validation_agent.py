"""
Validation Agent - Validates and scores chart recommendations with quality assessment
"""

import json
import logging
from typing import Dict, Any, List
from datetime import datetime

from .base_agent import BaseAgent
from app.models.base import AgentType
from app.models.analysis import (
    ChartRecommendation,
    ValidatedRecommendation,
    ValidationResult,
    AgentReasoning,
    ComprehensiveDataAnalysis
)

logger = logging.getLogger(__name__)


class ValidationAgent(BaseAgent):
    """Agent that validates and scores chart recommendations for quality"""

    def __init__(self):
        super().__init__(AgentType.VALIDATOR)

    async def validate(
        self,
        recommendations: List[ChartRecommendation],
        analysis: ComprehensiveDataAnalysis
    ) -> List[ValidatedRecommendation]:
        """Validate and score recommendations"""
        try:
            start_time = datetime.now()

            # Generate validation using AI
            validation_data = await self._generate_validation_scores(recommendations, analysis)

            # Create validated recommendations
            validated_recommendations = self._create_validated_recommendations(
                recommendations, validation_data, analysis
            )

            # Add processing time
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            for rec in validated_recommendations:
                rec.reasoning.append(AgentReasoning(
                    agent_type=AgentType.VALIDATOR,
                    reasoning="Chart recommendation validated and scored",
                    confidence=rec.validation_result.validation_score,
                    evidence=[],
                    processing_time_ms=processing_time
                ))

            # Sort by final score and assign rankings
            validated_recommendations.sort(key=lambda x: x.validation_result.final_score, reverse=True)
            for i, rec in enumerate(validated_recommendations):
                rec.final_ranking = i + 1

            return validated_recommendations

        except Exception as e:
            logger.error(f"Validation failed: {e}")
            raise

    async def _generate_validation_scores(
        self,
        recommendations: List[ChartRecommendation],
        analysis: ComprehensiveDataAnalysis
    ) -> Dict[str, Any]:
        """Generate validation scores using Gemini AI"""

        # Prepare recommendations summary for AI
        recs_summary = []
        for rec in recommendations:
            recs_summary.append({
                "chart_type": rec.chart_type.value,
                "confidence": rec.confidence,
                "suitability_score": rec.suitability_score,
                "data_mapping": {
                    "x_axis": rec.data_mapping.x_axis,
                    "y_axis": rec.data_mapping.y_axis,
                    "color": rec.data_mapping.color,
                    "size": rec.data_mapping.size
                },
                "reasoning": [r.reasoning for r in rec.reasoning]
            })

        data_summary = {
            "columns": analysis.statistical_summary.get("columns", {}),
            "correlations": analysis.correlations,
            "data_quality": analysis.data_quality,
            "row_count": analysis.statistical_summary.get("row_count", 0)
        }

        prompt = f"""
        As a data visualization validation expert, evaluate these chart recommendations for quality, appropriateness, and effectiveness.

        Dataset Analysis:
        {json.dumps(data_summary, default=str, indent=2)}

        Chart Recommendations to Validate:
        {json.dumps(recs_summary, default=str, indent=2)}

        For EACH chart recommendation, provide:
        1. Validation score (0.0-1.0) based on visualization best practices
        2. Quality metrics assessment
        3. Refinement suggestions
        4. Final score combining original confidence and validation

        Evaluation Criteria:
        - Data-ink ratio: Is the chart efficient in displaying information?
        - Cognitive load: How easy is it to understand?
        - Clarity: Is the message clear and unambiguous?
        - Appropriateness: Does the chart type match the data and intent?
        - Aesthetic quality: Is it visually appealing and professional?
        - Accessibility: Can it be understood by diverse audiences?

        Respond in JSON format:
        {{
            "validations": [
                {{
                    "chart_type": "bar",
                    "validation_score": 0.85,
                    "quality_metrics": {{
                        "data_ink_ratio": 0.8,
                        "cognitive_load": "low",
                        "clarity_score": 0.9,
                        "appropriateness": 0.85,
                        "aesthetic_quality": 0.8,
                        "accessibility": 0.9
                    }},
                    "refinements": {{
                        "suggested_title": "Improved chart title",
                        "axis_improvements": ["Add units to y-axis", "Rotate x-axis labels"],
                        "color_suggestions": "Use colorblind-friendly palette",
                        "layout_improvements": ["Increase chart height", "Add gridlines"]
                    }},
                    "final_score": 0.87,
                    "validation_reasoning": "Detailed explanation of validation..."
                }},
                ... (repeat for each recommendation)
            ]
        }}
        """

        response = await self.generate_response(
            prompt,
            system_instruction="You are an expert in data visualization validation and quality assessment. Provide detailed scoring in valid JSON format."
        )

        # Use the base agent's JSON extraction method
        json_response = self.extract_json_from_response(response)
        
        if not json_response:
            logger.error("Failed to parse validation response as JSON, using fallback")
            # Fallback to rule-based validation
            return self._fallback_validation(recommendations, analysis)
            
        return json_response

    def _create_validated_recommendations(
        self,
        recommendations: List[ChartRecommendation],
        validation_data: Dict[str, Any],
        analysis: ComprehensiveDataAnalysis
    ) -> List[ValidatedRecommendation]:
        """Create validated recommendations from original recommendations and validation data"""
        validated_recommendations = []
        validations = validation_data.get("validations", [])

        for i, rec in enumerate(recommendations):
            # Find corresponding validation
            validation = None
            for val in validations:
                if val.get("chart_type") == rec.chart_type.value:
                    validation = val
                    break

            if not validation:
                # Fallback validation if not found
                validation = self._create_fallback_validation(rec)

            # Create validation result
            validation_result = ValidationResult(
                chart_type=rec.chart_type,
                validation_score=float(validation.get("validation_score", 0.5)),
                quality_metrics=validation.get("quality_metrics", {}),
                refinements=validation.get("refinements", {}),
                final_score=float(validation.get("final_score", rec.confidence))
            )

            # Create validated recommendation
            validated_rec = ValidatedRecommendation(
                chart_type=rec.chart_type,
                confidence=rec.confidence,
                data_mapping=rec.data_mapping,
                reasoning=rec.reasoning.copy(),
                validation_result=validation_result,
                interaction_config=rec.interaction_config,
                styling_suggestions=rec.styling_suggestions,
                final_ranking=1  # Will be set later
            )

            # Add validation reasoning
            validated_rec.reasoning.append(AgentReasoning(
                agent_type=AgentType.VALIDATOR,
                reasoning=validation.get("validation_reasoning", "Validated using rule-based criteria"),
                confidence=validation_result.validation_score,
                evidence=list(validation_result.quality_metrics.keys())
            ))

            validated_recommendations.append(validated_rec)

        return validated_recommendations

    def _fallback_validation(
        self,
        recommendations: List[ChartRecommendation],
        analysis: ComprehensiveDataAnalysis
    ) -> Dict[str, Any]:
        """Fallback rule-based validation when AI parsing fails"""
        validations = []

        for rec in recommendations:
            # Simple rule-based scoring
            validation_score = self._calculate_rule_based_score(rec, analysis)

            quality_metrics = {
                "data_ink_ratio": 0.7,
                "cognitive_load": "medium",
                "clarity_score": 0.75,
                "appropriateness": validation_score,
                "aesthetic_quality": 0.7,
                "accessibility": 0.8
            }

            refinements = {
                "suggested_title": f"{rec.chart_type.value.title()} Chart",
                "axis_improvements": ["Add proper labels", "Include units"],
                "color_suggestions": "Use consistent color scheme",
                "layout_improvements": ["Optimize aspect ratio"]
            }

            final_score = (rec.confidence + validation_score) / 2

            validations.append({
                "chart_type": rec.chart_type.value,
                "validation_score": validation_score,
                "quality_metrics": quality_metrics,
                "refinements": refinements,
                "final_score": final_score,
                "validation_reasoning": f"Rule-based validation for {rec.chart_type.value} chart"
            })

        return {"validations": validations}

    def _create_fallback_validation(self, rec: ChartRecommendation) -> Dict[str, Any]:
        """Create a fallback validation for a single recommendation"""
        return {
            "chart_type": rec.chart_type.value,
            "validation_score": 0.7,
            "quality_metrics": {
                "data_ink_ratio": 0.7,
                "cognitive_load": "medium",
                "clarity_score": 0.75,
                "appropriateness": 0.7,
                "aesthetic_quality": 0.7,
                "accessibility": 0.8
            },
            "refinements": {
                "suggested_title": f"{rec.chart_type.value.title()} Chart",
                "axis_improvements": ["Add proper labels"],
                "color_suggestions": "Use accessible colors",
                "layout_improvements": ["Optimize layout"]
            },
            "final_score": rec.confidence,
            "validation_reasoning": "Fallback validation applied"
        }

    def _calculate_rule_based_score(
        self,
        rec: ChartRecommendation,
        analysis: ComprehensiveDataAnalysis
    ) -> float:
        """Calculate a simple rule-based validation score"""
        score = 0.5  # Base score

        columns = analysis.statistical_summary.get("columns", {})
        numeric_cols = [name for name, info in columns.items()
                       if info.get("data_type") == "numeric"]
        categorical_cols = [name for name, info in columns.items()
                           if info.get("data_type") == "categorical"]
        temporal_cols = [name for name, info in columns.items()
                        if info.get("data_type") == "temporal"]

        # Chart-specific validation rules
        if rec.chart_type.value == "bar":
            if rec.data_mapping.x_axis in categorical_cols and rec.data_mapping.y_axis in numeric_cols:
                score += 0.3
        elif rec.chart_type.value == "line":
            if rec.data_mapping.x_axis in temporal_cols and rec.data_mapping.y_axis in numeric_cols:
                score += 0.4
        elif rec.chart_type.value == "scatter":
            if rec.data_mapping.x_axis in numeric_cols and rec.data_mapping.y_axis in numeric_cols:
                score += 0.3
        elif rec.chart_type.value == "histogram":
            if rec.data_mapping.x_axis in numeric_cols:
                score += 0.3

        # Data quality considerations
        data_quality_score = analysis.data_quality.get("completeness", 0.5)
        score += data_quality_score * 0.2

        return min(1.0, score)

    async def analyze(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Implement abstract analyze method"""
        # For the ValidationAgent, this method can delegate to validate
        # when given appropriate data structure
        if "recommendations" in data and "analysis" in data:
            validated_recommendations = await self.validate(data["recommendations"], data["analysis"])
            return {
                "validated_recommendations": [rec.dict() for rec in validated_recommendations],
                "agent_type": self.agent_type.value
            }
        else:
            raise ValueError("ValidationAgent requires 'recommendations' and 'analysis' in input data")