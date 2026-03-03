"""
Clean Data Profiler Agent - Core data profiling with ProcessingContext integration
"""

import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from scipy import stats
from datetime import datetime

from .base_agent import BaseAgent, AgentResult
from app.models.base import AgentType
from app.models.processing_context import ProcessingContext
from app.models.analysis import ComprehensiveDataAnalysis
from app.services.gemini_ai_service import get_gemini_service

logger = logging.getLogger(__name__)


class DataProfilerAgent(BaseAgent):
    """
    Clean data profiler agent using ProcessingContext for efficient data sharing.
    Focuses on comprehensive statistical analysis and data quality assessment.
    """

    def __init__(self):
        super().__init__(AgentType.PROFILER)

    async def process(self, context: ProcessingContext) -> AgentResult:
        """
        Process dataset and return comprehensive profiling results.
        
        Args:
            context: ProcessingContext with sample data and caching
            
        Returns:
            AgentResult with ComprehensiveDataAnalysis
        """
        start_time = datetime.now()
        
        try:
            df = context.sample_data
            self.logger.info(f"Processing dataset with {len(df)} rows and {len(df.columns)} columns")

            # Use cached computations where possible
            statistical_summary = self._get_or_compute_statistical_summary(context, df)
            correlations = self._get_or_compute_correlations(context, df)
            patterns = self._get_or_compute_patterns(context, df)
            data_quality = self._get_or_compute_data_quality(context, df)

            # Get AI insights
            ai_insights = await self._get_ai_insights(statistical_summary, correlations, patterns)

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            # Create comprehensive analysis
            analysis = ComprehensiveDataAnalysis(
                dataset_id=context.dataset_id,
                statistical_summary=statistical_summary,
                correlations=correlations,
                patterns=patterns,
                data_quality=data_quality,
                temporal_patterns=None,  # Will be enhanced later
                recommendations_context={
                    "column_types": context.get_column_types(),
                    "numeric_columns": context.get_numeric_columns(),
                    "categorical_columns": context.get_categorical_columns(),
                    "temporal_columns": context.get_temporal_columns(),
                    "ai_insights": ai_insights  # Add AI insights
                },
                processing_time_ms=processing_time
            )

            return self._create_success_result(
                data=analysis.model_dump(),
                confidence=0.95,  # High confidence for statistical analysis
                processing_time_ms=processing_time
            )

        except Exception as e:
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            self.logger.error(f"Data profiler processing failed: {e}")
            return self._create_error_result(str(e), processing_time)

    def _get_or_compute_statistical_summary(self, context: ProcessingContext, df: pd.DataFrame) -> Dict[str, Any]:
        """Get statistical summary from cache or compute it"""
        cache_key = "statistical_summary"
        
        if context.has_cached_computation(cache_key):
            self.logger.debug("Using cached statistical summary")
            return context.get_cached_computation(cache_key)
        
        summary = self._compute_statistical_summary(df)
        context.cache_computation(cache_key, summary)
        return summary

    def _compute_statistical_summary(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Perform comprehensive statistical analysis on the dataset"""
        analysis = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": {}
        }

        for column in df.columns:
            col_analysis = {
                "name": column,
                "data_type": self._infer_data_type(df[column]),
                "null_count": int(df[column].isnull().sum()),
                "null_percentage": float((df[column].isnull().sum() / len(df)) * 100),
                "unique_count": int(df[column].nunique()),
                "unique_percentage": float((df[column].nunique() / len(df)) * 100)
            }

            # Numeric column analysis
            if pd.api.types.is_numeric_dtype(df[column]):
                col_analysis.update(self._analyze_numeric_column(df[column]))
            
            # Categorical column analysis
            elif col_analysis["unique_count"] < 50:
                col_analysis.update(self._analyze_categorical_column(df[column]))
            
            # Text column analysis
            else:
                col_analysis.update(self._analyze_text_column(df[column]))

            analysis["columns"][column] = col_analysis

        return analysis

    def _analyze_numeric_column(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze numeric column with comprehensive statistics"""
        if series.isnull().all():
            return {"analysis_type": "numeric", "all_null": True}
        
        clean_series = series.dropna()
        
        return {
            "analysis_type": "numeric",
            "mean": float(clean_series.mean()),
            "median": float(clean_series.median()),
            "std": float(clean_series.std()),
            "min": float(clean_series.min()),
            "max": float(clean_series.max()),
            "quartiles": {
                "q1": float(clean_series.quantile(0.25)),
                "q2": float(clean_series.quantile(0.5)),
                "q3": float(clean_series.quantile(0.75))
            },
            "skewness": float(clean_series.skew()),
            "kurtosis": float(clean_series.kurtosis()),
            "range": float(clean_series.max() - clean_series.min()),
            "variance": float(clean_series.var())
        }

    def _analyze_categorical_column(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze categorical column"""
        value_counts = series.value_counts().head(10)
        
        return {
            "analysis_type": "categorical",
            "top_values": {str(k): int(v) for k, v in value_counts.to_dict().items()},
            "mode": str(series.mode().iloc[0]) if not series.mode().empty else None,
            "entropy": float(-sum((p := value_counts / len(series)) * np.log2(p + 1e-10)))
        }

    def _analyze_text_column(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze text column"""
        clean_series = series.dropna().astype(str)
        
        if len(clean_series) == 0:
            return {"analysis_type": "text", "all_null": True}
        
        lengths = clean_series.str.len()
        
        return {
            "analysis_type": "text",
            "avg_length": float(lengths.mean()),
            "min_length": int(lengths.min()),
            "max_length": int(lengths.max()),
            "empty_strings": int((clean_series == "").sum())
        }

    def _get_or_compute_correlations(self, context: ProcessingContext, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Get correlations from cache or compute them"""
        cache_key = "correlations"
        
        if context.has_cached_computation(cache_key):
            self.logger.debug("Using cached correlations")
            return context.get_cached_computation(cache_key)
        
        correlations = self._compute_correlations(df)
        context.cache_computation(cache_key, correlations)
        return correlations

    def _compute_correlations(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Analyze correlations between numeric columns"""
        correlations = []
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        if len(numeric_cols) > 1:
            corr_matrix = df[numeric_cols].corr()
            min_correlation_threshold = 0.3

            for i, col1 in enumerate(numeric_cols):
                for j, col2 in enumerate(numeric_cols[i+1:], i+1):
                    correlation = corr_matrix.iloc[i, j]
                    
                    if not pd.isna(correlation) and abs(correlation) > min_correlation_threshold:
                        correlations.append({
                            "column1": col1,
                            "column2": col2,
                            "correlation": float(correlation),
                            "strength": self._correlation_strength(correlation),
                            "type": "pearson"
                        })

        self.logger.info(f"Found {len(correlations)} significant correlations")
        return correlations

    def _get_or_compute_patterns(self, context: ProcessingContext, df: pd.DataFrame) -> Dict[str, Any]:
        """Get patterns from cache or compute them"""
        cache_key = "patterns"
        
        if context.has_cached_computation(cache_key):
            self.logger.debug("Using cached patterns")
            return context.get_cached_computation(cache_key)
        
        patterns = self._compute_patterns(df)
        context.cache_computation(cache_key, patterns)
        return patterns

    def _compute_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Identify patterns in the data"""
        patterns = {
            "trends": {},
            "outliers": {},
            "distributions": {}
        }

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        
        for col in numeric_cols:
            if not df[col].isnull().all():
                patterns["trends"][col] = self._analyze_trend(df[col])
                patterns["outliers"][col] = self._detect_outliers(df[col])
                patterns["distributions"][col] = self._analyze_distribution(df[col])

        return patterns

    def _analyze_trend(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze trend in a numeric series"""
        clean_series = series.dropna()
        if len(clean_series) < 3:
            return {"trend": "insufficient_data"}
        
        x = np.arange(len(clean_series))
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, clean_series)

        return {
            "slope": float(slope),
            "r_squared": float(r_value ** 2),
            "p_value": float(p_value),
            "trend": "increasing" if slope > 0 else "decreasing" if slope < 0 else "stable",
            "significance": "significant" if p_value < 0.05 else "not_significant"
        }

    def _detect_outliers(self, series: pd.Series) -> Dict[str, Any]:
        """Detect outliers using IQR method"""
        clean_series = series.dropna()
        if len(clean_series) < 4:
            return {"count": 0, "percentage": 0.0}
        
        Q1 = clean_series.quantile(0.25)
        Q3 = clean_series.quantile(0.75)
        IQR = Q3 - Q1
        
        outliers = clean_series[(clean_series < (Q1 - 1.5 * IQR)) | (clean_series > (Q3 + 1.5 * IQR))]

        return {
            "count": len(outliers),
            "percentage": float((len(outliers) / len(clean_series)) * 100),
            "method": "iqr"
        }

    def _analyze_distribution(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze distribution characteristics"""
        clean_series = series.dropna()
        if len(clean_series) < 3:
            return {"distribution": "insufficient_data"}
        
        # Test for normality
        try:
            _, p_value = stats.normaltest(clean_series)
            is_normal = p_value > 0.05
        except:
            is_normal = False
        
        return {
            "is_normal": is_normal,
            "skewness": float(clean_series.skew()),
            "kurtosis": float(clean_series.kurtosis())
        }

    def _get_or_compute_data_quality(self, context: ProcessingContext, df: pd.DataFrame) -> Dict[str, Any]:
        """Get data quality metrics from cache or compute them"""
        cache_key = "data_quality"
        
        if context.has_cached_computation(cache_key):
            self.logger.debug("Using cached data quality metrics")
            return context.get_cached_computation(cache_key)
        
        quality = self._compute_data_quality(df)
        context.cache_computation(cache_key, quality)
        return quality

    def _compute_data_quality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Assess comprehensive data quality"""
        total_cells = df.size
        missing_cells = df.isnull().sum().sum()

        quality = {
            "completeness": float(1 - (missing_cells / total_cells)) if total_cells > 0 else 0.0,
            "missing_data": {
                "total_missing": int(missing_cells),
                "percentage": float((missing_cells / total_cells) * 100) if total_cells > 0 else 0.0,
                "columns_with_missing": df.columns[df.isnull().any()].tolist()
            },
            "data_types": {
                "numeric_columns": len(df.select_dtypes(include=[np.number]).columns),
                "categorical_columns": len(df.select_dtypes(include=['object', 'category']).columns),
                "datetime_columns": len(df.select_dtypes(include=['datetime64']).columns)
            },
            "duplicates": {
                "count": int(df.duplicated().sum()),
                "percentage": float((df.duplicated().sum() / len(df)) * 100) if len(df) > 0 else 0.0
            },
            "consistency": self._assess_consistency(df)
        }

        return quality

    def _assess_consistency(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Assess data consistency"""
        consistency_issues = []
        
        # Check for mixed data types in object columns
        for col in df.select_dtypes(include=['object']).columns:
            types = df[col].dropna().apply(type).unique()
            if len(types) > 1:
                consistency_issues.append(f"Mixed types in column {col}")
        
        return {
            "issues": consistency_issues,
            "score": float(max(0.0, 1.0 - len(consistency_issues) / len(df.columns)))
        }

    def _infer_data_type(self, series: pd.Series) -> str:
        """Infer data type for a pandas Series"""
        if pd.api.types.is_numeric_dtype(series):
            return "numeric"
        elif pd.api.types.is_datetime64_any_dtype(series):
            return "temporal"
        elif pd.api.types.is_bool_dtype(series):
            return "categorical"
        elif series.nunique() < 50 and series.nunique() / len(series) < 0.5:
            return "categorical"
        else:
            return "text"

    def _correlation_strength(self, correlation: float) -> str:
        """Determine correlation strength"""
        abs_corr = abs(correlation)
        if abs_corr >= 0.8:
            return "very_strong"
        elif abs_corr >= 0.6:
            return "strong"
        elif abs_corr >= 0.4:
            return "moderate"
        elif abs_corr >= 0.2:
            return "weak"
        else:
            return "very_weak"

    async def _get_ai_insights(
        self, 
        statistical_summary: Dict[str, Any],
        correlations: List[Dict[str, Any]],
        patterns: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get AI-powered insights for the data profile"""
        try:
            gemini_service = get_gemini_service()
            insights = await gemini_service.generate_data_profile_insights(
                statistical_summary, correlations, patterns
            )
            self.logger.info("Successfully generated AI insights for data profile")
            return insights
        except Exception as e:
            self.logger.warning(f"AI insights failed, using fallback: {e}")
            return {
                "insights": ["Statistical analysis completed"],
                "data_quality_score": 0.7,
                "recommended_actions": ["Review data quality"],
                "analysis_opportunities": ["Explore data patterns"]
            }

    def get_fallback_result(self, context: ProcessingContext, error: str = None) -> AgentResult:
        """Rule-based fallback when processing fails"""
        try:
            df = context.sample_data
            
            # Basic fallback analysis
            basic_summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "columns": {col: {"name": col, "data_type": "unknown"} for col in df.columns}
            }
            
            basic_quality = {
                "completeness": 0.5,  # Conservative estimate
                "missing_data": {"total_missing": 0, "percentage": 0.0, "columns_with_missing": []},
                "data_types": {"numeric_columns": 0, "categorical_columns": 0, "datetime_columns": 0},
                "duplicates": {"count": 0, "percentage": 0.0}
            }
            
            fallback_analysis = ComprehensiveDataAnalysis(
                dataset_id=context.dataset_id,
                statistical_summary=basic_summary,
                correlations=[],
                patterns={},
                data_quality=basic_quality,
                processing_time_ms=0
            )
            
            return self._create_success_result(
                data=fallback_analysis.model_dump(),
                confidence=0.3,  # Low confidence for fallback
                processing_time_ms=0
            )
            
        except Exception as fallback_error:
            self.logger.error(f"Fallback also failed: {fallback_error}")
            return self._create_error_result(f"Processing and fallback failed: {error}")
