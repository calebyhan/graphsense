"""
Clean Chart Recommender Agent - Chart recommendations with ProcessingContext integration
"""

import logging
from typing import Dict, Any, List
from datetime import datetime

from .base_agent import BaseAgent, AgentResult
from app.models.base import AgentType, ChartType
from app.models.processing_context import ProcessingContext
from app.models.analysis import (
    ChartRecommendation,
    DataMapping,
    AgentReasoning,
    InteractionConfig,
    ComprehensiveDataAnalysis
)
from app.services.gemini_ai_service import get_gemini_service

logger = logging.getLogger(__name__)


class ChartRecommenderAgent(BaseAgent):
    """
    Clean chart recommender agent using ProcessingContext for efficient data access.
    Generates intelligent chart recommendations based on profiler results.
    """

    def __init__(self):
        super().__init__(AgentType.RECOMMENDER)
        self.chart_types = [chart_type for chart_type in ChartType]

    async def process(self, context: ProcessingContext) -> AgentResult:
        """
        Process profiler results and generate chart recommendations.
        
        Args:
            context: ProcessingContext with profiler results and data access
            
        Returns:
            AgentResult with list of ChartRecommendation objects
        """
        start_time = datetime.now()
        
        try:
            # Get profiler results from context cache
            profiler_data = context.get_cached_computation("statistical_summary")
            correlations = context.get_cached_computation("correlations") or []
            patterns = context.get_cached_computation("patterns") or {}
            
            if not profiler_data:
                raise ValueError("No profiler results available in context")

            self.logger.info(f"Generating recommendations for dataset with {profiler_data.get('column_count', 0)} columns")

            # Generate AI-powered recommendations
            ai_recommendations = await self._get_ai_recommendations(
                profiler_data, context, correlations
            )
            
            # Generate rule-based recommendations as backup
            rule_recommendations = self._generate_intelligent_recommendations(
                context, profiler_data, correlations, patterns
            )
            
            # Combine AI and rule-based recommendations
            recommendations = self._combine_recommendations(ai_recommendations, rule_recommendations)

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return self._create_success_result(
                data={"recommendations": [rec.model_dump() for rec in recommendations]},
                confidence=0.85,  # High confidence for rule-based recommendations
                processing_time_ms=processing_time
            )

        except Exception as e:
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            self.logger.error(f"Chart recommender processing failed: {e}", exc_info=True)
            return self._create_error_result(str(e), processing_time)

    def _generate_intelligent_recommendations(
        self, 
        context: ProcessingContext,
        profiler_data: Dict[str, Any], 
        correlations: List[Dict[str, Any]], 
        patterns: Dict[str, Any]
    ) -> List[ChartRecommendation]:
        """Generate intelligent chart recommendations based on data analysis"""
        recommendations = []
        
        # Get column information
        columns = profiler_data.get("columns", {})
        numeric_cols = context.get_numeric_columns()
        categorical_cols = context.get_categorical_columns()
        temporal_cols = context.get_temporal_columns()
        
        self.logger.info(f"Column analysis: {len(numeric_cols)} numeric, {len(categorical_cols)} categorical, {len(temporal_cols)} temporal")

        # Generate recommendations based on data characteristics
        recommendations.extend(self._recommend_for_categorical_numeric(columns, categorical_cols, numeric_cols))
        recommendations.extend(self._recommend_for_temporal_data(columns, temporal_cols, numeric_cols))
        recommendations.extend(self._recommend_for_numeric_relationships(columns, numeric_cols, correlations))
        recommendations.extend(self._recommend_for_distributions(columns, numeric_cols, patterns, categorical_cols))
        recommendations.extend(self._recommend_for_categorical_analysis(columns, categorical_cols, numeric_cols))
        recommendations.extend(self._recommend_for_advanced_charts(columns, categorical_cols, numeric_cols))

        # Sort by confidence and return top recommendations
        recommendations.sort(key=lambda x: x.confidence, reverse=True)
        
        # Limit to top 5 recommendations to avoid overwhelming users
        final_recommendations = recommendations[:5]
        
        self.logger.info(f"Generated {len(final_recommendations)} chart recommendations")
        return final_recommendations

    def _recommend_for_categorical_numeric(
        self, 
        columns: Dict[str, Any], 
        categorical_cols: List[str], 
        numeric_cols: List[str]
    ) -> List[ChartRecommendation]:
        """Recommend charts for categorical vs numeric data"""
        recommendations = []
        
        if not categorical_cols or not numeric_cols:
            return recommendations
        
        # Bar chart recommendation
        primary_cat = categorical_cols[0]
        primary_num = numeric_cols[0]
        
        # Check if categorical column has reasonable number of categories
        cat_info = columns.get(primary_cat, {})
        unique_count = cat_info.get("unique_count", 0)
        
        if unique_count <= 20:  # Good for bar charts
            confidence = 0.9 if unique_count <= 10 else 0.7
            
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.BAR,
                confidence=confidence,
                data_mapping=DataMapping(
                    x_axis=primary_cat,
                    y_axis=primary_num,
                    color=categorical_cols[1] if len(categorical_cols) > 1 else None
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Bar chart is excellent for comparing {primary_num} across {primary_cat} categories ({unique_count} categories)",
                    confidence=confidence,
                    evidence=[
                        f"Categorical column {primary_cat} has {unique_count} unique values",
                        f"Numeric column {primary_num} provides measurable values for comparison"
                    ]
                )],
                interaction_config=InteractionConfig(zoom_enabled=False, pan_enabled=False, hover_enabled=True),
                styling_suggestions={
                    "title": f"{primary_num} by {primary_cat}",
                    "color_scheme": "categorical"
                },
                suitability_score=confidence
            ))
        
        # Grouped bar chart if multiple numeric columns
        if len(numeric_cols) > 1 and unique_count <= 10:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.BAR,
                confidence=0.75,
                data_mapping=DataMapping(
                    x_axis=primary_cat,
                    y_axis=numeric_cols[1],
                    color=primary_num  # Use first numeric as color/grouping
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Grouped bar chart can compare multiple numeric measures across {primary_cat}",
                    confidence=0.75,
                    evidence=[f"Multiple numeric columns available: {', '.join(numeric_cols[:3])}"]
                )],
                interaction_config=InteractionConfig(zoom_enabled=False, pan_enabled=False, hover_enabled=True),
                styling_suggestions={
                    "title": f"Multi-measure comparison by {primary_cat}",
                    "color_scheme": "sequential"
                },
                suitability_score=0.75
            ))

        # Box plot for grouped distribution comparison (not just when outliers are detected)
        if unique_count <= 15:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.BOX_PLOT,
                confidence=0.7,
                data_mapping=DataMapping(
                    x_axis=primary_cat,
                    y_axis=primary_num,
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Box plot compares the distribution of {primary_num} across {primary_cat} groups, revealing median, spread, and outliers",
                    confidence=0.7,
                    evidence=[
                        f"{primary_cat} has {unique_count} groups",
                        "Box plot reveals per-group median, IQR, and outliers"
                    ]
                )],
                interaction_config=InteractionConfig(zoom_enabled=False, pan_enabled=False, hover_enabled=True),
                styling_suggestions={
                    "title": f"{primary_num} Distribution by {primary_cat}",
                    "color_scheme": "categorical"
                },
                suitability_score=0.7
            ))

        return recommendations

    def _recommend_for_temporal_data(
        self, 
        columns: Dict[str, Any], 
        temporal_cols: List[str], 
        numeric_cols: List[str]
    ) -> List[ChartRecommendation]:
        """Recommend charts for temporal data"""
        recommendations = []
        
        if not temporal_cols or not numeric_cols:
            return recommendations
        
        primary_temporal = temporal_cols[0]
        primary_numeric = numeric_cols[0]
        
        # Line chart for time series
        recommendations.append(ChartRecommendation(
            chart_type=ChartType.LINE,
            confidence=0.95,
            data_mapping=DataMapping(
                x_axis=primary_temporal,
                y_axis=primary_numeric
            ),
            reasoning=[AgentReasoning(
                agent_type=AgentType.RECOMMENDER,
                reasoning=f"Line chart is perfect for showing {primary_numeric} trends over {primary_temporal}",
                confidence=0.95,
                evidence=[
                    f"Temporal column {primary_temporal} provides time dimension",
                    f"Numeric column {primary_numeric} shows measurable changes over time"
                ]
            )],
            interaction_config=InteractionConfig(zoom_enabled=True, pan_enabled=True, hover_enabled=True),
            styling_suggestions={
                "title": f"{primary_numeric} over {primary_temporal}",
                "color_scheme": "sequential"
            },
            suitability_score=0.95
        ))
        
        # Area chart for cumulative data
        if len(numeric_cols) > 1:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.AREA,
                confidence=0.8,
                data_mapping=DataMapping(
                    x_axis=primary_temporal,
                    y_axis=numeric_cols[1]
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Area chart shows cumulative effect of {numeric_cols[1]} over time",
                    confidence=0.8,
                    evidence=[f"Multiple numeric measures available for temporal analysis"]
                )],
                interaction_config=InteractionConfig(zoom_enabled=True, pan_enabled=True, hover_enabled=True),
                styling_suggestions={
                    "title": f"{numeric_cols[1]} area over {primary_temporal}",
                    "color_scheme": "sequential"
                },
                suitability_score=0.8
            ))
        
        return recommendations

    def _recommend_for_numeric_relationships(
        self, 
        columns: Dict[str, Any], 
        numeric_cols: List[str], 
        correlations: List[Dict[str, Any]]
    ) -> List[ChartRecommendation]:
        """Recommend charts for numeric relationships"""
        recommendations = []
        
        if len(numeric_cols) < 2:
            return recommendations
        
        # Scatter plot for correlation analysis
        if correlations:
            # Use the strongest correlation
            strongest_corr = max(correlations, key=lambda x: abs(x.get("correlation", 0)))
            col1, col2 = strongest_corr["column1"], strongest_corr["column2"]
            corr_strength = strongest_corr.get("strength", "weak")
            corr_value = strongest_corr.get("correlation", 0)
            
            confidence = 0.9 if abs(corr_value) > 0.6 else 0.7
            
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.SCATTER,
                confidence=confidence,
                data_mapping=DataMapping(
                    x_axis=col1,
                    y_axis=col2
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Scatter plot reveals {corr_strength} correlation ({corr_value:.2f}) between {col1} and {col2}",
                    confidence=confidence,
                    evidence=[
                        f"Correlation coefficient: {corr_value:.2f}",
                        f"Correlation strength: {corr_strength}"
                    ]
                )],
                interaction_config=InteractionConfig(
                    zoom_enabled=True, 
                    pan_enabled=True, 
                    selection_enabled=True,
                    hover_enabled=True
                ),
                styling_suggestions={
                    "title": f"{col1} vs {col2} Relationship",
                    "color_scheme": "continuous"
                },
                suitability_score=confidence
            ))
        else:
            # Default scatter plot for first two numeric columns
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.SCATTER,
                confidence=0.6,
                data_mapping=DataMapping(
                    x_axis=numeric_cols[0],
                    y_axis=numeric_cols[1]
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Scatter plot explores potential relationship between {numeric_cols[0]} and {numeric_cols[1]}",
                    confidence=0.6,
                    evidence=["Two numeric columns available for relationship analysis"]
                )],
                interaction_config=InteractionConfig(
                    zoom_enabled=True, 
                    pan_enabled=True, 
                    selection_enabled=True,
                    hover_enabled=True
                ),
                styling_suggestions={
                    "title": f"{numeric_cols[0]} vs {numeric_cols[1]}",
                    "color_scheme": "continuous"
                },
                suitability_score=0.6
            ))
        
        return recommendations

    def _recommend_for_distributions(
        self,
        columns: Dict[str, Any],
        numeric_cols: List[str],
        patterns: Dict[str, Any],
        categorical_cols: List[str] = None,
    ) -> List[ChartRecommendation]:
        """Recommend charts for distribution analysis"""
        recommendations = []
        
        if not numeric_cols:
            return recommendations
        
        # Histogram for distribution analysis
        primary_numeric = numeric_cols[0]
        
        # Check if we have distribution info
        distributions = patterns.get("distributions", {})
        primary_dist = distributions.get(primary_numeric, {})
        
        confidence = 0.8
        reasoning_text = f"Histogram shows the distribution pattern of {primary_numeric}"
        evidence = [f"Numeric column {primary_numeric} suitable for distribution analysis"]
        
        if primary_dist:
            is_normal = primary_dist.get("is_normal", False)
            skewness = primary_dist.get("skewness", 0)
            
            if is_normal:
                reasoning_text += " (appears normally distributed)"
                confidence = 0.85
            elif abs(skewness) > 1:
                reasoning_text += f" (shows {'right' if skewness > 0 else 'left'} skew)"
                confidence = 0.9
            
            evidence.append(f"Distribution analysis: normal={is_normal}, skewness={skewness:.2f}")
        
        recommendations.append(ChartRecommendation(
            chart_type=ChartType.HISTOGRAM,
            confidence=confidence,
            # Set both x_axis and y_axis to the numeric column.
            # The frontend extracts histogram's "value" param from data_mapping.y_axis,
            # while D3Histogram also falls back to x_axis — setting both ensures
            # the parameter resolves regardless of which path is taken.
            data_mapping=DataMapping(
                x_axis=primary_numeric,
                y_axis=primary_numeric
            ),
            reasoning=[AgentReasoning(
                agent_type=AgentType.RECOMMENDER,
                reasoning=reasoning_text,
                confidence=confidence,
                evidence=evidence
            )],
            interaction_config=InteractionConfig(zoom_enabled=True, pan_enabled=False, hover_enabled=True),
            styling_suggestions={
                "title": f"Distribution of {primary_numeric}",
                "color_scheme": "sequential"
            },
            suitability_score=confidence
        ))
        
        # Box plot for outlier analysis if outliers detected.
        # If a categorical column is available, group by it so the chart is differentiated
        # from the single-group histogram above. Without an x_axis the frontend heuristic
        # would pick a categorical column anyway, producing a confusingly grouped box plot
        # that looks identical to the one already generated in _recommend_for_categorical_numeric.
        outliers = patterns.get("outliers", {}).get(primary_numeric, {})
        if outliers and outliers.get("count", 0) > 0:
            outlier_percentage = outliers.get("percentage", 0)
            primary_cat = (categorical_cols or [None])[0]

            recommendations.append(ChartRecommendation(
                chart_type=ChartType.BOX_PLOT,
                confidence=0.75,
                data_mapping=DataMapping(
                    x_axis=primary_cat,  # explicit None on numeric-only datasets → single-group render
                    y_axis=primary_numeric,
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Box plot reveals outliers in {primary_numeric} ({outlier_percentage:.1f}% outliers detected)",
                    confidence=0.75,
                    evidence=[
                        f"Outliers detected: {outliers.get('count', 0)} ({outlier_percentage:.1f}%)",
                        "Box plot excellent for outlier visualization"
                    ]
                )],
                interaction_config=InteractionConfig(zoom_enabled=False, pan_enabled=False, hover_enabled=True),
                styling_suggestions={
                    "title": f"{primary_numeric} Distribution with Outliers",
                    "color_scheme": "categorical"
                },
                suitability_score=0.75
            ))
        
        return recommendations

    def _recommend_for_advanced_charts(
        self,
        columns: Dict[str, Any],
        categorical_cols: List[str],
        numeric_cols: List[str],
    ) -> List[ChartRecommendation]:
        """Recommend heatmap, treemap, and sankey when data structure supports them"""
        recommendations = []

        if not categorical_cols or not numeric_cols:
            return recommendations

        primary_cat = categorical_cols[0]
        primary_num = numeric_cols[0]
        cat1_unique = columns.get(primary_cat, {}).get("unique_count", 0)

        # Treemap: categorical + numeric, especially useful when too many categories for a bar chart
        if cat1_unique > 10:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.TREEMAP,
                confidence=0.7,
                data_mapping=DataMapping(
                    x_axis=primary_cat,
                    y_axis=primary_num,
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Treemap shows proportional breakdown of {primary_num} across {cat1_unique} {primary_cat} categories — more readable than a bar chart at this cardinality",
                    confidence=0.7,
                    evidence=[f"{primary_cat} has {cat1_unique} categories — exceeds ideal bar chart range"]
                )],
                interaction_config=InteractionConfig(zoom_enabled=False, pan_enabled=False, hover_enabled=True),
                styling_suggestions={
                    "title": f"{primary_num} by {primary_cat}",
                    "color_scheme": "categorical"
                },
                suitability_score=0.7
            ))

        if len(categorical_cols) < 2:
            return recommendations

        cat2 = categorical_cols[1]
        cat2_unique = columns.get(cat2, {}).get("unique_count", 0)

        # Heatmap: 2 categorical columns + 1 numeric, each with reasonable cardinality.
        # Encoding:  x_axis → colField (cat2),  color → rowField (cat1),  y_axis → valueField (numeric).
        # resolveFromDataMapping maps: xAxisParams→x_axis, yAxisParams→y_axis, color→rowField/color.
        if 2 <= cat1_unique <= 30 and 2 <= cat2_unique <= 30:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.HEATMAP,
                confidence=0.75,
                data_mapping=DataMapping(
                    x_axis=cat2,        # → colField
                    y_axis=primary_num, # → valueField
                    color=primary_cat,  # → rowField (via color→rowField resolution in frontend)
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Heatmap shows {primary_num} across the {primary_cat} × {cat2} matrix",
                    confidence=0.75,
                    evidence=[
                        f"{primary_cat} has {cat1_unique} categories",
                        f"{cat2} has {cat2_unique} categories",
                    ]
                )],
                interaction_config=InteractionConfig(zoom_enabled=False, pan_enabled=False, hover_enabled=True),
                styling_suggestions={
                    "title": f"{primary_num} Heatmap: {primary_cat} × {cat2}",
                    "color_scheme": "sequential"
                },
                suitability_score=0.75
            ))

        # Sankey: 2 categorical columns + 1 numeric, each with low-to-moderate cardinality.
        # Encoding: x_axis → source (cat1),  y_axis → weight (numeric),  color → target (cat2).
        # resolveFromDataMapping maps color → target via the color→target resolution path.
        if 2 <= cat1_unique <= 15 and 2 <= cat2_unique <= 15:
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.SANKEY,
                confidence=0.65,
                data_mapping=DataMapping(
                    x_axis=primary_cat,  # → source
                    y_axis=primary_num,  # → weight
                    color=cat2,          # → target (via color→target resolution in frontend)
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Sankey diagram shows flow of {primary_num} from {primary_cat} to {cat2}",
                    confidence=0.65,
                    evidence=[
                        f"Two categorical columns ({primary_cat}, {cat2}) form source/target nodes",
                        f"{primary_num} provides flow weight"
                    ]
                )],
                interaction_config=InteractionConfig(zoom_enabled=False, pan_enabled=False, hover_enabled=True),
                styling_suggestions={
                    "title": f"Flow: {primary_cat} → {cat2}",
                    "color_scheme": "categorical"
                },
                suitability_score=0.65
            ))

        return recommendations

    def _recommend_for_categorical_analysis(
        self,
        columns: Dict[str, Any],
        categorical_cols: List[str],
        numeric_cols: List[str] = None
    ) -> List[ChartRecommendation]:
        """Recommend charts for categorical data analysis"""
        recommendations = []
        numeric_cols = numeric_cols or []

        if not categorical_cols:
            return recommendations

        primary_categorical = categorical_cols[0]
        cat_info = columns.get(primary_categorical, {})
        unique_count = cat_info.get("unique_count", 0)

        # Pie chart for categorical distribution (if reasonable number of categories)
        # x_axis = category field (slice labels), y_axis = numeric value (slice sizes)
        if 2 <= unique_count <= 8:
            primary_value = numeric_cols[0] if numeric_cols else None
            recommendations.append(ChartRecommendation(
                chart_type=ChartType.PIE,
                confidence=0.7,
                data_mapping=DataMapping(
                    x_axis=primary_categorical,
                    y_axis=primary_value,
                    color=primary_categorical
                ),
                reasoning=[AgentReasoning(
                    agent_type=AgentType.RECOMMENDER,
                    reasoning=f"Pie chart shows proportion distribution of {primary_categorical} ({unique_count} categories)",
                    confidence=0.7,
                    evidence=[
                        f"Categorical column {primary_categorical} has {unique_count} categories",
                        "Ideal number of categories for pie chart visualization"
                    ]
                )],
                interaction_config=InteractionConfig(zoom_enabled=False, pan_enabled=False, hover_enabled=True),
                styling_suggestions={
                    "title": f"Distribution of {primary_categorical}",
                    "color_scheme": "categorical"
                },
                suitability_score=0.7
            ))
        
        return recommendations

    async def _get_ai_recommendations(
        self,
        profiler_data: Dict[str, Any],
        context: ProcessingContext,
        correlations: List[Dict[str, Any]]
    ) -> List[ChartRecommendation]:
        """Get AI-powered chart recommendations"""
        try:
            gemini_service = get_gemini_service()

            # Build enriched dataset context for the prompt
            column_types = context.get_column_types()
            column_samples = context.get_column_samples()
            stat_columns = profiler_data.get("columns", {})

            columns_for_prompt = []
            for col_name, col_type in column_types.items():
                entry: Dict[str, Any] = {
                    "name": col_name,
                    "type": col_type,
                    "sample_values": column_samples.get(col_name, []),
                    "unique_count": stat_columns.get(col_name, {}).get("unique_count", 0),
                    "null_pct": round(stat_columns.get(col_name, {}).get("null_percentage", 0), 2),
                }
                if col_type == "numeric":
                    # Stats are stored flat in the column dict by DataProfilerAgent
                    # (e.g. col_dict["mean"], col_dict["min"]) — not under a "numeric_stats" sub-key.
                    col_stats = stat_columns.get(col_name, {})
                    if col_stats.get("analysis_type") == "numeric" or col_stats.get("mean") is not None:
                        entry["min"] = col_stats.get("min")
                        entry["max"] = col_stats.get("max")
                        entry["mean"] = round(col_stats["mean"], 4) if col_stats.get("mean") is not None else None
                        entry["std"] = round(col_stats["std"], 4) if col_stats.get("std") is not None else None
                columns_for_prompt.append(entry)

            # Only pass genuinely strong correlations (|r| > 0.5) to the AI.
            # All correlations in the cache have |r| > 0.3 (the profiler's threshold),
            # but labelling weak ones as "strong" misleads the model.
            strong_corrs = [
                {"col1": c["column1"], "col2": c["column2"], "r": round(c.get("correlation", 0), 3),
                 "strength": c.get("strength", "moderate")}
                for c in correlations
                if abs(c.get("correlation", 0)) > 0.5
            ]
            dataset_context = {
                "row_count": profiler_data.get("row_count", 0),
                "column_count": profiler_data.get("column_count", 0),
                "columns": columns_for_prompt,
                "strong_correlations": strong_corrs,
            }

            ai_recs = await gemini_service.generate_chart_recommendations(dataset_context)

            if ai_recs and ai_recs[0].get("_source") == "fallback":
                self.logger.warning(
                    "AI service returned static fallback recommendations (not Gemini output). "
                    "Charts will be rule-based only."
                )

            # Convert AI recommendations to ChartRecommendation objects
            recommendations = []
            for ai_rec in ai_recs:
                try:
                    chart_type = ChartType(ai_rec.get("chart_type", "bar"))
                    
                    recommendation = ChartRecommendation(
                        chart_type=chart_type,
                        confidence=ai_rec.get("confidence", 0.7),
                        data_mapping=DataMapping(
                            x_axis=ai_rec.get("x_axis"),
                            y_axis=ai_rec.get("y_axis"),
                            color=ai_rec.get("color")
                        ),
                        reasoning=[AgentReasoning(
                            agent_type=AgentType.RECOMMENDER,
                            reasoning=ai_rec.get("reasoning", "AI-generated recommendation"),
                            confidence=ai_rec.get("confidence", 0.7),
                            evidence=ai_rec.get("best_for", [])
                        )],
                        interaction_config=self._get_interaction_config(chart_type),
                        styling_suggestions={
                            "title": f"{chart_type.value.title()} Chart",
                            "color_scheme": "categorical"
                        },
                        suitability_score=ai_rec.get("confidence", 0.7)
                    )
                    recommendations.append(recommendation)
                except Exception as e:
                    self.logger.warning(
                        f"Failed to convert AI recommendation "
                        f"(chart_type={ai_rec.get('chart_type')!r}, "
                        f"x={ai_rec.get('x_axis')!r}, y={ai_rec.get('y_axis')!r}): {e}"
                    )
                    continue

            if not recommendations:
                self.logger.warning(
                    "AI returned %d raw recs but 0 converted successfully "
                    "(check chart_type enum values in the response above)",
                    len(ai_recs),
                )
            else:
                self.logger.info(f"Generated {len(recommendations)} AI recommendations")
            return recommendations

        except Exception as e:
            self.logger.error(
                f"AI recommendations failed, falling back to rule-based only: {e}",
                exc_info=True,
            )
            return []

    def _get_interaction_config(self, chart_type: ChartType) -> InteractionConfig:
        """Get appropriate interaction configuration for chart type"""
        if chart_type in [ChartType.LINE, ChartType.AREA, ChartType.SCATTER]:
            return InteractionConfig(zoom_enabled=True, pan_enabled=True, hover_enabled=True)
        elif chart_type in [ChartType.BAR, ChartType.COLUMN]:
            return InteractionConfig(zoom_enabled=False, pan_enabled=False, hover_enabled=True)
        else:
            return InteractionConfig(zoom_enabled=False, pan_enabled=False, hover_enabled=True)

    def _combine_recommendations(
        self, 
        ai_recommendations: List[ChartRecommendation],
        rule_recommendations: List[ChartRecommendation]
    ) -> List[ChartRecommendation]:
        """Combine AI and rule-based recommendations intelligently"""
        
        # If AI recommendations are available, prioritize them
        if ai_recommendations:
            # Dedup by (chart_type, x_axis, y_axis) so two bar charts for different
            # column pairs are both kept, but exact duplicates are dropped.
            ai_keys = {
                (rec.chart_type, rec.data_mapping.x_axis, rec.data_mapping.y_axis)
                for rec in ai_recommendations
            }
            unique_rule_recs = [
                rec for rec in rule_recommendations
                if (rec.chart_type, rec.data_mapping.x_axis, rec.data_mapping.y_axis) not in ai_keys
            ]
            
            # Combine and sort by confidence
            all_recommendations = ai_recommendations + unique_rule_recs[:2]  # Max 2 rule-based
        else:
            # Fall back to rule-based recommendations
            all_recommendations = rule_recommendations
        
        # Sort by confidence and return top 5
        all_recommendations.sort(key=lambda x: x.confidence, reverse=True)
        return all_recommendations[:5]

    def get_fallback_result(self, context: ProcessingContext, error: str = None) -> AgentResult:
        """Rule-based fallback when processing fails"""
        try:
            # Get basic column information from context
            numeric_cols = context.get_numeric_columns()
            categorical_cols = context.get_categorical_columns()
            temporal_cols = context.get_temporal_columns()
            
            fallback_recommendations = []
            
            # Basic bar chart if we have categorical and numeric
            if categorical_cols and numeric_cols:
                fallback_recommendations.append(ChartRecommendation(
                    chart_type=ChartType.BAR,
                    confidence=0.5,
                    data_mapping=DataMapping(
                        x_axis=categorical_cols[0],
                        y_axis=numeric_cols[0]
                    ),
                    reasoning=[AgentReasoning(
                        agent_type=AgentType.RECOMMENDER,
                        reasoning="Basic bar chart recommendation (fallback)",
                        confidence=0.5,
                        evidence=["Fallback recommendation based on column types"]
                    )],
                    interaction_config=InteractionConfig(),
                    styling_suggestions={"title": "Basic Chart"},
                    suitability_score=0.5
                ))
            
            # Basic line chart if we have temporal and numeric
            elif temporal_cols and numeric_cols:
                fallback_recommendations.append(ChartRecommendation(
                    chart_type=ChartType.LINE,
                    confidence=0.5,
                    data_mapping=DataMapping(
                        x_axis=temporal_cols[0],
                        y_axis=numeric_cols[0]
                    ),
                    reasoning=[AgentReasoning(
                        agent_type=AgentType.RECOMMENDER,
                        reasoning="Basic line chart recommendation (fallback)",
                        confidence=0.5,
                        evidence=["Fallback recommendation based on column types"]
                    )],
                    interaction_config=InteractionConfig(),
                    styling_suggestions={"title": "Basic Time Series"},
                    suitability_score=0.5
                ))
            
            # Basic scatter plot if we have multiple numeric
            elif len(numeric_cols) >= 2:
                fallback_recommendations.append(ChartRecommendation(
                    chart_type=ChartType.SCATTER,
                    confidence=0.4,
                    data_mapping=DataMapping(
                        x_axis=numeric_cols[0],
                        y_axis=numeric_cols[1]
                    ),
                    reasoning=[AgentReasoning(
                        agent_type=AgentType.RECOMMENDER,
                        reasoning="Basic scatter plot recommendation (fallback)",
                        confidence=0.4,
                        evidence=["Fallback recommendation based on column types"]
                    )],
                    interaction_config=InteractionConfig(),
                    styling_suggestions={"title": "Basic Scatter Plot"},
                    suitability_score=0.4
                ))
            
            return self._create_success_result(
                data={"recommendations": [rec.model_dump() for rec in fallback_recommendations]},
                confidence=0.3,  # Low confidence for fallback
                processing_time_ms=0
            )
            
        except Exception as fallback_error:
            self.logger.error(f"Fallback also failed: {fallback_error}")
            return self._create_error_result(f"Processing and fallback failed: {error}")