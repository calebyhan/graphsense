"""
Enhanced Data Profiler Agent - Combines profiling, pattern recognition, and statistical analysis
"""

import json
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from scipy import stats
from sklearn.preprocessing import LabelEncoder
from datetime import datetime

from .base_agent import BaseAgent
from app.models.base import AgentType
from app.models.analysis import ComprehensiveDataAnalysis
from app.models.processing_context import ProcessingContext
from app.utils.data_sampling import DataSampler, calculate_significance_threshold
from app.utils.intelligent_cache import get_intelligent_cache

logger = logging.getLogger(__name__)


class EnhancedDataProfilerAgent(BaseAgent):
    """Enhanced agent that combines data profiling, pattern recognition, and statistical analysis"""

    def __init__(self, max_sample_size: int = 5000):
        super().__init__(AgentType.PROFILER)
        self.data_sampler = DataSampler(max_sample_size=max_sample_size)
        self.max_sample_size = max_sample_size
        self.cache = get_intelligent_cache()

    async def analyze(self, data: List[Dict[str, Any]]) -> ComprehensiveDataAnalysis:
        """Perform comprehensive data analysis with intelligent sampling"""
        try:
            start_time = datetime.now()
            original_size = len(data)

            # Apply intelligent sampling for large datasets
            sampled_data = self.data_sampler.smart_sample(data, self.max_sample_size)
            sampled_size = len(sampled_data)
            
            # Get sampling metadata
            sampling_metadata = self.data_sampler.get_sampling_metadata(original_size, sampled_size)
            
            logger.info(f"Dataset sampling: {original_size} -> {sampled_size} rows (ratio: {sampling_metadata['sampling_ratio']:.3f})")

            # Convert to DataFrame for analysis
            df = pd.DataFrame(sampled_data)

            # Perform all analyses on sampled data
            statistical_summary = self._statistical_analysis(df, sampling_metadata)
            correlations = self._correlation_analysis(df, sampling_metadata)
            patterns = self._pattern_analysis(df)
            data_quality = self._data_quality_analysis(df, sampling_metadata)
            temporal_patterns = self._temporal_analysis(df)

            # Generate AI insights using Gemini
            ai_insights = await self._generate_ai_insights(df, {
                "statistical_summary": statistical_summary,
                "correlations": correlations,
                "patterns": patterns,
                "data_quality": data_quality,
                "sampling_metadata": sampling_metadata
            })

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return ComprehensiveDataAnalysis(
                dataset_id="",  # Will be set by caller
                statistical_summary=statistical_summary,
                correlations=correlations,
                patterns=patterns,
                data_quality=data_quality,
                temporal_patterns=temporal_patterns,
                recommendations_context=ai_insights,
                processing_time_ms=processing_time
            )

        except Exception as e:
            logger.error(f"Enhanced profiler analysis failed: {e}")
            raise

    async def analyze_with_context(self, context: ProcessingContext) -> ComprehensiveDataAnalysis:
        """
        Perform comprehensive data analysis using shared processing context.
        This method leverages cached computations to avoid redundant calculations.
        """
        try:
            start_time = datetime.now()
            
            logger.info(f"Starting context-aware analysis for dataset {context.dataset_id}")
            logger.info(f"Context cache summary: {context.get_cache_summary()}")

            # Use the sample data from context
            df = context.sample_data
            
            # Get sampling metadata
            sampling_metadata = {
                "original_size": context.original_data_size,
                "is_sampled": len(df) < context.original_data_size,
                "sampling_ratio": len(df) / context.original_data_size if context.original_data_size > 0 else 1.0
            }

            # Perform analyses with caching
            statistical_summary = self._statistical_analysis_with_cache(df, sampling_metadata, context)
            correlations = self._correlation_analysis_with_cache(df, sampling_metadata, context)
            patterns = self._pattern_analysis_with_cache(df, context)
            data_quality = self._data_quality_analysis_with_cache(df, sampling_metadata, context)
            temporal_patterns = self._temporal_analysis(df)

            # Generate AI insights using Gemini
            ai_insights = await self._generate_ai_insights(df, {
                "statistical_summary": statistical_summary,
                "correlations": correlations,
                "patterns": patterns,
                "data_quality": data_quality,
                "sampling_metadata": sampling_metadata
            })

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            # Create comprehensive analysis
            analysis = ComprehensiveDataAnalysis(
                dataset_id=context.dataset_id,
                statistical_summary=statistical_summary,
                correlations=correlations,
                patterns=patterns,
                data_quality=data_quality,
                temporal_patterns=temporal_patterns,
                recommendations_context=ai_insights,
                processing_time_ms=processing_time
            )

            # Cache the results in context for other agents
            context.profiler_results = analysis
            context.update_memory_usage()

            logger.info(f"Context-aware analysis completed in {processing_time}ms")
            return analysis

        except Exception as e:
            logger.error(f"Context-aware profiler analysis failed: {e}")
            raise

    def _statistical_analysis_with_cache(self, df: pd.DataFrame, sampling_metadata: Dict[str, Any], context: ProcessingContext) -> Dict[str, Any]:
        """Perform statistical analysis with caching support"""
        # Check if we have cached statistical summary
        cached_stats = context.get_cached_statistic("statistical_summary")
        if cached_stats:
            logger.info("Using cached statistical summary")
            return cached_stats
        
        # Compute statistical analysis
        analysis = self._statistical_analysis(df, sampling_metadata)
        
        # Cache the results
        context.cache_statistic("statistical_summary", analysis)
        
        # Also cache individual column metadata for reuse
        for column, col_analysis in analysis.get("columns", {}).items():
            context.cache_column_metadata(column, col_analysis)
        
        return analysis

    def _statistical_analysis(self, df: pd.DataFrame, sampling_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Perform statistical analysis on the dataset"""
        analysis = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "original_row_count": sampling_metadata["original_size"],
            "is_sampled": sampling_metadata["is_sampled"],
            "sampling_ratio": sampling_metadata["sampling_ratio"],
            "columns": {}
        }

        for column in df.columns:
            col_analysis = {
                "name": column,
                "data_type": self._infer_data_type(df[column]),
                "null_count": df[column].isnull().sum(),
                "null_percentage": (df[column].isnull().sum() / len(df)) * 100,
                "unique_count": df[column].nunique(),
                "unique_percentage": (df[column].nunique() / len(df)) * 100
            }

            # Numeric column analysis
            if pd.api.types.is_numeric_dtype(df[column]):
                col_analysis.update({
                    "mean": float(df[column].mean()) if not df[column].isnull().all() else None,
                    "median": float(df[column].median()) if not df[column].isnull().all() else None,
                    "std": float(df[column].std()) if not df[column].isnull().all() else None,
                    "min": float(df[column].min()) if not df[column].isnull().all() else None,
                    "max": float(df[column].max()) if not df[column].isnull().all() else None,
                    "quartiles": df[column].quantile([0.25, 0.5, 0.75]).to_dict() if not df[column].isnull().all() else None
                })

            # Categorical column analysis
            elif col_analysis["unique_count"] < 50:  # Treat as categorical if unique values < 50
                value_counts = df[column].value_counts().head(10)
                col_analysis.update({
                    "top_values": value_counts.to_dict(),
                    "mode": df[column].mode().iloc[0] if not df[column].mode().empty else None
                })

            analysis["columns"][column] = col_analysis

        return analysis

    def _correlation_analysis_with_cache(self, df: pd.DataFrame, sampling_metadata: Dict[str, Any], context: ProcessingContext) -> List[Dict[str, Any]]:
        """Perform correlation analysis with caching support"""
        # Check if we have cached correlation results
        cached_correlations = context.get_cached_statistic("correlations")
        if cached_correlations:
            logger.info("Using cached correlation analysis")
            return cached_correlations
        
        # Check if we have cached correlation matrix
        cached_matrix = context.get_cached_correlation()
        if cached_matrix is not None:
            logger.info("Using cached correlation matrix to generate results")
            correlations = self._process_correlation_matrix(cached_matrix, df, sampling_metadata)
        else:
            # Compute correlation analysis
            correlations = self._correlation_analysis(df, sampling_metadata)
            
            # Cache the correlation matrix for potential reuse
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if len(numeric_cols) > 1:
                corr_matrix = df[numeric_cols].corr()
                context.cache_correlation(corr_matrix)
        
        # Cache the correlation results
        context.cache_statistic("correlations", correlations)
        
        return correlations

    def _correlation_analysis(self, df: pd.DataFrame, sampling_metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze correlations between numeric columns with significance testing"""
        correlations = []

        # Get numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        if len(numeric_cols) > 1:
            # Calculate significance threshold based on sample size
            sample_size = len(df)
            significance_threshold = calculate_significance_threshold(sample_size)
            
            # Use higher threshold for small samples or when data is sampled
            min_correlation_threshold = max(0.1, significance_threshold)
            if sampling_metadata["is_sampled"]:
                min_correlation_threshold = max(min_correlation_threshold, 0.15)
            
            logger.info(f"Using correlation threshold: {min_correlation_threshold:.3f} (sample_size: {sample_size})")

            corr_matrix = df[numeric_cols].corr()

            for i, col1 in enumerate(numeric_cols):
                for j, col2 in enumerate(numeric_cols[i+1:], i+1):
                    correlation = corr_matrix.iloc[i, j]
                    
                    if not pd.isna(correlation) and abs(correlation) > min_correlation_threshold:
                        # Calculate p-value for correlation significance
                        try:
                            # Remove NaN values for correlation test
                            col1_data = df[col1].dropna()
                            col2_data = df[col2].dropna()
                            
                            # Align the data (keep only rows where both columns have values)
                            aligned_data = df[[col1, col2]].dropna()
                            if len(aligned_data) >= 3:  # Need at least 3 points for correlation
                                _, p_value = stats.pearsonr(aligned_data[col1], aligned_data[col2])
                            else:
                                p_value = 1.0  # Not significant if too few data points
                        except:
                            p_value = 1.0  # Default to not significant if calculation fails
                        
                        correlations.append({
                            "column1": col1,
                            "column2": col2,
                            "correlation": float(correlation),
                            "strength": self._correlation_strength(correlation),
                            "type": "pearson",
                            "p_value": float(p_value),
                            "is_significant": p_value < 0.05,
                            "sample_size": len(aligned_data) if 'aligned_data' in locals() else sample_size,
                            "significance_threshold": min_correlation_threshold
                        })

        logger.info(f"Found {len(correlations)} significant correlations")
        return correlations

    def _pattern_analysis_with_cache(self, df: pd.DataFrame, context: ProcessingContext) -> Dict[str, Any]:
        """Perform pattern analysis with caching support"""
        # Check if we have cached pattern analysis
        cached_patterns = context.get_cached_statistic("patterns")
        if cached_patterns:
            logger.info("Using cached pattern analysis")
            return cached_patterns
        
        # Compute pattern analysis
        patterns = self._pattern_analysis(df)
        
        # Cache individual pattern types for potential reuse
        for pattern_type, pattern_data in patterns.items():
            context.cache_pattern(pattern_type, pattern_data)
        
        # Cache the complete patterns
        context.cache_statistic("patterns", patterns)
        
        return patterns

    def _pattern_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Identify patterns in the data"""
        patterns = {
            "trends": {},
            "seasonality": {},
            "outliers": {},
            "distributions": {}
        }

        # Analyze trends in numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        for col in numeric_cols:
            if not df[col].isnull().all():
                # Simple trend analysis
                x = np.arange(len(df))
                y = df[col].fillna(df[col].mean())
                slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

                patterns["trends"][col] = {
                    "slope": float(slope),
                    "r_squared": float(r_value ** 2),
                    "p_value": float(p_value),
                    "trend": "increasing" if slope > 0 else "decreasing" if slope < 0 else "stable"
                }

                # Outlier detection using IQR
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                outliers = df[(df[col] < (Q1 - 1.5 * IQR)) | (df[col] > (Q3 + 1.5 * IQR))]

                patterns["outliers"][col] = {
                    "count": len(outliers),
                    "percentage": (len(outliers) / len(df)) * 100
                }

        return patterns

    def _data_quality_analysis_with_cache(self, df: pd.DataFrame, sampling_metadata: Dict[str, Any], context: ProcessingContext) -> Dict[str, Any]:
        """Perform data quality analysis with caching support"""
        # Check if we have cached data quality analysis
        cached_quality = context.get_cached_statistic("data_quality")
        if cached_quality:
            logger.info("Using cached data quality analysis")
            return cached_quality
        
        # Compute data quality analysis
        quality = self._data_quality_analysis(df, sampling_metadata)
        
        # Cache individual quality metrics for potential reuse
        for metric, value in quality.items():
            if isinstance(value, (int, float, str, bool)):
                context.cache_data_quality(metric, value)
        
        # Cache the complete quality analysis
        context.cache_statistic("data_quality", quality)
        
        return quality

    def _data_quality_analysis(self, df: pd.DataFrame, sampling_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Assess data quality with sampling considerations"""
        total_cells = df.size
        missing_cells = df.isnull().sum().sum()

        quality = {
            "completeness": 1 - (missing_cells / total_cells),
            "missing_data": {
                "total_missing": int(missing_cells),
                "percentage": (missing_cells / total_cells) * 100,
                "columns_with_missing": df.columns[df.isnull().any()].tolist()
            },
            "data_types": {
                "numeric_columns": len(df.select_dtypes(include=[np.number]).columns),
                "categorical_columns": len(df.select_dtypes(include=['object', 'category']).columns),
                "datetime_columns": len(df.select_dtypes(include=['datetime64']).columns)
            },
            "duplicates": {
                "count": df.duplicated().sum(),
                "percentage": (df.duplicated().sum() / len(df)) * 100
            },
            "sampling_info": {
                "is_sampled": sampling_metadata["is_sampled"],
                "original_size": sampling_metadata["original_size"],
                "sample_size": len(df),
                "sampling_ratio": sampling_metadata["sampling_ratio"]
            }
        }

        # Add sampling quality indicators
        if sampling_metadata["is_sampled"]:
            quality["sampling_quality"] = {
                "representativeness_score": min(1.0, sampling_metadata["sampling_ratio"] * 2),  # Higher is better
                "confidence_level": "high" if sampling_metadata["sampling_ratio"] > 0.1 else "medium" if sampling_metadata["sampling_ratio"] > 0.01 else "low"
            }

        return quality

    def _temporal_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze temporal patterns if datetime columns exist"""
        temporal_patterns = None
        datetime_cols = df.select_dtypes(include=['datetime64']).columns.tolist()

        # Try to detect datetime columns from object columns
        for col in df.select_dtypes(include=['object']).columns:
            if self._is_datetime_column(df[col]):
                try:
                    df[col] = pd.to_datetime(df[col])
                    datetime_cols.append(col)
                except:
                    pass

        if datetime_cols:
            temporal_patterns = {
                "datetime_columns": datetime_cols,
                "time_range": {},
                "frequency": {}
            }

            for col in datetime_cols:
                temporal_patterns["time_range"][col] = {
                    "start": df[col].min().isoformat() if not df[col].isnull().all() else None,
                    "end": df[col].max().isoformat() if not df[col].isnull().all() else None,
                    "span_days": (df[col].max() - df[col].min()).days if not df[col].isnull().all() else None
                }

        return temporal_patterns

    async def _generate_ai_insights(self, df: pd.DataFrame, analysis_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate AI insights using Gemini with sampling awareness and caching"""
        try:
            sampling_info = analysis_data.get('sampling_metadata', {})
            
            prompt = f"""
            As a data analysis expert, provide insights for this dataset based on the following analysis:

            Dataset Overview:
            - Sample Rows: {len(df)}
            - Original Rows: {sampling_info.get('original_size', len(df))}
            - Is Sampled: {sampling_info.get('is_sampled', False)}
            - Sampling Ratio: {sampling_info.get('sampling_ratio', 1.0):.3f}
            - Columns: {len(df.columns)}
            - Column names: {list(df.columns)}

            Statistical Summary: {json.dumps(analysis_data['statistical_summary'], default=str, indent=2)}

            Correlations Found: {len(analysis_data.get('correlations', []))}

            {"Note: This analysis is based on a statistical sample of the data. " if sampling_info.get('is_sampled') else ""}

            Provide insights in JSON format with the following structure:
            {{
                "key_insights": ["insight1", "insight2", ...],
                "data_characteristics": "brief description",
                "recommended_analysis_approaches": ["approach1", "approach2", ...],
                "potential_visualizations": ["viz1", "viz2", ...],
                "data_quality_assessment": "brief assessment",
                "sampling_considerations": "considerations about sampling if applicable"
            }}
            """

            # Generate prompt hash for caching
            context = {"dataset_preview": df.head().to_dict()}
            prompt_hash = self.cache.generate_prompt_hash(prompt, context)
            
            # Check cache first
            cached_response = self.cache.get_cached_ai_response(prompt_hash)
            if cached_response:
                logger.debug(f"Using cached AI insights for prompt hash: {prompt_hash}")
                return cached_response

            # Generate new response
            response = await self.generate_response(
                prompt,
                context=context,
                system_instruction="You are an expert data analyst. Provide concise, actionable insights in valid JSON format. Consider sampling implications in your analysis."
            )

            # Parse JSON response using the base agent's extraction method
            json_response = self.extract_json_from_response(response)
            
            if json_response:
                # Add sampling metadata to insights
                if sampling_info.get('is_sampled'):
                    json_response['sampling_metadata'] = sampling_info
                
                # Cache the successful response
                self.cache.cache_ai_response(prompt_hash, json_response)
                logger.debug(f"Cached AI insights for prompt hash: {prompt_hash}")
                
                return json_response
            else:
                logger.warning("Failed to parse AI insights as JSON, returning raw response")
                fallback_response = {"raw_insights": response}
                
                # Cache even the fallback response to avoid repeated failures
                self.cache.cache_ai_response(prompt_hash, fallback_response)
                
                return fallback_response

        except Exception as e:
            logger.error(f"Failed to generate AI insights: {e}")
            return {"error": str(e)}

    def _infer_data_type(self, series: pd.Series) -> str:
        """Infer data type for a pandas Series"""
        if pd.api.types.is_numeric_dtype(series):
            return "numeric"
        elif pd.api.types.is_datetime64_any_dtype(series):
            return "temporal"
        elif pd.api.types.is_bool_dtype(series):
            return "boolean"
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

    def _is_datetime_column(self, series: pd.Series) -> bool:
        """Check if a series might contain datetime data"""
        sample = series.dropna().head(10)
        if len(sample) == 0:
            return False

        datetime_patterns = [
            r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
            r'\d{2}/\d{2}/\d{4}',  # MM/DD/YYYY
            r'\d{2}-\d{2}-\d{4}',  # MM-DD-YYYY
        ]

        import re
        for pattern in datetime_patterns:
            if any(re.search(pattern, str(val)) for val in sample):
                return True

        return False

    def _process_correlation_matrix(self, corr_matrix: pd.DataFrame, df: pd.DataFrame, sampling_metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process cached correlation matrix to generate correlation results"""
        correlations = []
        
        # Calculate significance threshold based on sample size
        sample_size = len(df)
        significance_threshold = calculate_significance_threshold(sample_size)
        
        # Use higher threshold for small samples or when data is sampled
        min_correlation_threshold = max(0.1, significance_threshold)
        if sampling_metadata["is_sampled"]:
            min_correlation_threshold = max(min_correlation_threshold, 0.15)
        
        numeric_cols = corr_matrix.columns.tolist()
        
        for i, col1 in enumerate(numeric_cols):
            for j, col2 in enumerate(numeric_cols[i+1:], i+1):
                correlation = corr_matrix.iloc[i, j]
                
                if not pd.isna(correlation) and abs(correlation) > min_correlation_threshold:
                    # Calculate p-value for correlation significance
                    try:
                        # Remove NaN values for correlation test
                        aligned_data = df[[col1, col2]].dropna()
                        if len(aligned_data) >= 3:  # Need at least 3 points for correlation
                            _, p_value = stats.pearsonr(aligned_data[col1], aligned_data[col2])
                        else:
                            p_value = 1.0  # Not significant if too few data points
                    except:
                        p_value = 1.0  # Default to not significant if calculation fails
                    
                    correlations.append({
                        "column1": col1,
                        "column2": col2,
                        "correlation": float(correlation),
                        "strength": self._correlation_strength(correlation),
                        "type": "pearson",
                        "p_value": float(p_value),
                        "is_significant": p_value < 0.05,
                        "sample_size": len(aligned_data) if 'aligned_data' in locals() else sample_size,
                        "significance_threshold": min_correlation_threshold
                    })
        
        return correlations