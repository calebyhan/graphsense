"""
Clean Validation Agent - Chart validation with ProcessingContext integration
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from .base_agent import BaseAgent, AgentResult
from app.models.base import AgentType, ChartType
from app.models.processing_context import ProcessingContext
from app.models.analysis import (
    ChartRecommendation,
    ValidatedRecommendation,
    ValidationResult,
    AgentReasoning,
    DataMapping,
    InteractionConfig
)
from app.services.gemini_ai_service import get_gemini_service

logger = logging.getLogger(__name__)


class ValidationAgent(BaseAgent):
    """
    Clean validation agent using ProcessingContext for comprehensive chart validation.
    Validates and scores chart recommendations based on data characteristics and best practices.
    """

    def __init__(self):
        super().__init__(AgentType.VALIDATOR)
        
        # Validation criteria weights
        self.validation_weights = {
            "data_appropriateness": 0.4,
            "visual_clarity": 0.25,
            "accessibility": 0.2,
            "interactivity": 0.15
        }

    async def process(self, context: ProcessingContext) -> AgentResult:
        """
        Process chart recommendations and return validation results.
        
        Args:
            context: ProcessingContext with recommendations and data access
            
        Returns:
            AgentResult with list of ValidatedRecommendation objects
        """
        start_time = datetime.now()
        
        try:
            # Get recommendations from context or previous agent results
            recommendations_data = context.get_cached_computation("recommendations")
            
            if not recommendations_data:
                raise ValueError("No recommendations available in context for validation")

            # Parse recommendations
            recommendations = self._parse_recommendations(recommendations_data)
            
            if not recommendations:
                raise ValueError("No valid recommendations to validate")

            self.logger.info(f"Validating {len(recommendations)} chart recommendations")

            # Get data characteristics for validation
            profiler_data = context.get_cached_computation("statistical_summary")
            correlations = context.get_cached_computation("correlations") or []
            patterns = context.get_cached_computation("patterns") or {}

            # Get AI validation insights
            ai_validations = await self._get_ai_validations(
                [rec.model_dump() for rec in recommendations],
                {"profiler_data": profiler_data, "correlations": correlations}
            )

            # Match validations by position: we sent slim_recs in order and expect the AI
            # to return validations in the same order.  The AI response schema only includes
            # chart_type (not x_axis/y_axis), so a key-based lookup always misses for
            # duplicate chart types (e.g. two bar charts) — index matching is more reliable.
            def _ai_validation_at(idx: int) -> dict | None:
                if idx < len(ai_validations):
                    return ai_validations[idx]
                # Fallback: match by chart_type only if the index is out of range
                return next(
                    (v for v in ai_validations if v.get("chart_type") == recommendations[idx].chart_type.value),
                    None,
                )

            # Validate each recommendation with AI insights
            validated_recommendations = []
            for i, rec in enumerate(recommendations):
                ai_validation = _ai_validation_at(i)
                validated_rec = self._validate_recommendation(
                    rec, context, profiler_data, correlations, patterns, ai_validation
                )
                validated_recommendations.append(validated_rec)

            # Sort by final score and update rankings
            validated_recommendations.sort(key=lambda x: x.validation_result.final_score, reverse=True)
            for i, rec in enumerate(validated_recommendations):
                rec.final_ranking = i + 1

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return self._create_success_result(
                data={"validated_recommendations": [rec.model_dump() for rec in validated_recommendations]},
                confidence=0.9,  # High confidence for validation
                processing_time_ms=processing_time
            )

        except Exception as e:
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            self.logger.error(f"Validation processing failed: {e}", exc_info=True)
            return self._create_error_result(str(e), processing_time)



    def _parse_recommendations(self, recommendations_data: List[Dict[str, Any]]) -> List[ChartRecommendation]:
        """Parse recommendation data into ChartRecommendation objects"""
        recommendations = []
        
        for rec_data in recommendations_data:
            try:
                # Create ChartRecommendation from dict data
                rec = ChartRecommendation(**rec_data)
                recommendations.append(rec)
            except Exception as e:
                self.logger.warning(f"Failed to parse recommendation: {e}")
                continue
        
        return recommendations

    def _validate_recommendation(
        self,
        recommendation: ChartRecommendation,
        context: ProcessingContext,
        profiler_data: Dict[str, Any],
        correlations: List[Dict[str, Any]],
        patterns: Dict[str, Any],
        ai_validation: Optional[Dict[str, Any]] = None
    ) -> ValidatedRecommendation:
        """Validate a single chart recommendation comprehensively"""
        
        # Use AI validation scores if available, otherwise use defaults
        if ai_validation and "scores" in ai_validation:
            ai_scores = ai_validation["scores"]
            data_appropriateness = ai_scores.get("data_appropriateness", 0.8)
            visual_clarity = ai_scores.get("visual_clarity", 0.7)
            accessibility = ai_scores.get("accessibility", 0.6)
            interactivity = ai_scores.get("interactivity", 0.5)
        else:
            # Default validation scoring
            data_appropriateness = 0.8
            visual_clarity = 0.7
            accessibility = 0.6
            interactivity = 0.5
        
        # Calculate weighted validation score
        validation_score = (
            data_appropriateness * self.validation_weights["data_appropriateness"] +
            visual_clarity * self.validation_weights["visual_clarity"] +
            accessibility * self.validation_weights["accessibility"] +
            interactivity * self.validation_weights["interactivity"]
        )
        
        # Calculate final score combining original confidence and validation
        final_score = (recommendation.confidence * 0.6) + (validation_score * 0.4)
        
        # Create validation result
        validation_result = ValidationResult(
            chart_type=recommendation.chart_type,
            validation_score=validation_score,
            quality_metrics={
                "data_appropriateness": data_appropriateness,
                "visual_clarity": visual_clarity,
                "accessibility": accessibility,
                "interactivity": interactivity
            },
            refinements={"suggested_title": f"{recommendation.chart_type.value.title()} Chart"},
            final_score=final_score
        )
        
        # Create validation reasoning
        validation_reasoning = AgentReasoning(
            agent_type=AgentType.VALIDATOR,
            reasoning=f"Validated {recommendation.chart_type.value} chart with score {final_score:.2f}",
            confidence=final_score,
            evidence=[f"Validation score: {validation_score:.2f}"]
        )
        
        # Combine original and validation reasoning
        all_reasoning = recommendation.reasoning + [validation_reasoning]
        
        # Create validated recommendation
        validated_rec = ValidatedRecommendation(
            id=recommendation.id,
            chart_type=recommendation.chart_type,
            confidence=recommendation.confidence,
            data_mapping=recommendation.data_mapping,
            reasoning=all_reasoning,
            validation_result=validation_result,
            interaction_config=recommendation.interaction_config,
            styling_suggestions=recommendation.styling_suggestions,
            final_ranking=1  # Will be updated after sorting
        )
        
        return validated_rec

    async def _get_ai_validations(
        self,
        recommendations: List[Dict[str, Any]],
        data_characteristics: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Get AI-powered validation for recommendations"""
        try:
            gemini_service = get_gemini_service()
            validations = await gemini_service.validate_chart_recommendations(
                recommendations, data_characteristics
            )
            self.logger.info(f"Generated AI validations for {len(recommendations)} recommendations")
            return validations
        except Exception as e:
            self.logger.error(f"AI validation failed: {e}", exc_info=True)
            return []

    def get_fallback_result(self, context: ProcessingContext, error: str = None) -> AgentResult:
        """Rule-based fallback when validation fails"""
        try:
            # Try to get recommendations from context
            recommendations_data = context.get_cached_computation("recommendations")
            
            if recommendations_data:
                # Create basic validated recommendations with default scores
                fallback_validated = []
                
                for i, rec_data in enumerate(recommendations_data[:3]):  # Limit to 3
                    try:
                        # Create basic validation result
                        validation_result = ValidationResult(
                            chart_type=ChartType(rec_data.get("chart_type", "bar")),
                            validation_score=0.5,
                            quality_metrics={
                                "data_appropriateness": 0.5,
                                "visual_clarity": 0.5,
                                "accessibility": 0.5,
                                "interactivity": 0.5
                            },
                            refinements={"suggested_title": "Chart"},
                            final_score=0.5
                        )
                        
                        # Create basic validated recommendation
                        validated_rec = ValidatedRecommendation(
                            chart_type=ChartType(rec_data.get("chart_type", "bar")),
                            confidence=rec_data.get("confidence", 0.5),
                            data_mapping=DataMapping(**rec_data.get("data_mapping", {})),
                            reasoning=[AgentReasoning(
                                agent_type=AgentType.VALIDATOR,
                                reasoning="Basic validation (fallback)",
                                confidence=0.5,
                                evidence=["Fallback validation applied"]
                            )],
                            validation_result=validation_result,
                            interaction_config=InteractionConfig(),
                            styling_suggestions={"title": "Chart"},
                            final_ranking=i + 1
                        )
                        
                        fallback_validated.append(validated_rec)
                        
                    except Exception as rec_error:
                        self.logger.warning(f"Failed to create fallback validation for recommendation: {rec_error}")
                        continue
                
                return self._create_success_result(
                    data={"validated_recommendations": [rec.model_dump() for rec in fallback_validated]},
                    confidence=0.3,  # Low confidence for fallback
                    processing_time_ms=0
                )
            
            # If no recommendations available, return empty result
            return self._create_success_result(
                data={"validated_recommendations": []},
                confidence=0.1,
                processing_time_ms=0
            )
            
        except Exception as fallback_error:
            self.logger.error(f"Fallback also failed: {fallback_error}")
            return self._create_error_result(f"Processing and fallback failed: {error}")