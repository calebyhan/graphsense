"""
Simplified Data Profiler Agent - Core data profiling functionality
"""

import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from scipy import stats
from datetime import datetime

from .base_agent import BaseAgent
from app.models.base import AgentType
from app.models.analysis import ComprehensiveDataAnalysis

logger = logging.getLogger(__name__)


class DataProfilerAgent(BaseAgent):
    """Simplified agent for core data profiling functionality"""

    def __init__(self):
        super().__init__(AgentType.PROFILER)

    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process dataset and return basic profiling results"""
        try:
            if not self.validate_input(data):
                return self.get_fallback_result(data)

            start_time = datetime.now()
            
            # Extract dataset from input
            dataset = data.get("dataset", [])
            if not dataset:
                raise ValueError("No dataset provided in input")

            # Convert to DataFrame for analysis
            df = pd.DataFrame(dataset)
            logger.info(f"Processing dataset with {len(df)} rows and {len(df.columns)} columns")

            # Perform core analyses
            statistical_summary = self._statistical_analysis(df)
            correlations = self._correlation_analysis(df)
            patterns = self._pattern_analysis(df)
            data_quality = self._data_quality_analysis(df)

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            # Create analysis result
            analysis = ComprehensiveDataAnalysis(
                dataset_id=data.get("dataset_id", ""),
                statistical_summary=statistical_summary,
                correlations=correlations,
                patterns=patterns,
                data_quality=data_quality,
                temporal_patterns=None,  # Simplified - no temporal analysis for now
                recommendations_context={},  # Simplified - no AI insights for now
                processing_time_ms=processing_time
            )

            return self._format_output(analysis.model_dump(), success=True)

        except Exception as e:
            logger.error(f"Data profiler processing failed: {e}")
            return self.get_fallback_result(data)



    def _statistical_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Perform basic statistical analysis on the dataset"""
        analysis = {
            "row_count": len(df),
            "column_count": len(df.columns),
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

    def _correlation_analysis(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Analyze correlations between numeric columns"""
        correlations = []

        # Get numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        if len(numeric_cols) > 1:
            corr_matrix = df[numeric_cols].corr()
            min_correlation_threshold = 0.3  # Simple threshold

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

        logger.info(f"Found {len(correlations)} significant correlations")
        return correlations



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

    def _data_quality_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Assess basic data quality"""
        total_cells = df.size
        missing_cells = df.isnull().sum().sum()

        quality = {
            "completeness": 1 - (missing_cells / total_cells) if total_cells > 0 else 0,
            "missing_data": {
                "total_missing": int(missing_cells),
                "percentage": (missing_cells / total_cells) * 100 if total_cells > 0 else 0,
                "columns_with_missing": df.columns[df.isnull().any()].tolist()
            },
            "data_types": {
                "numeric_columns": len(df.select_dtypes(include=[np.number]).columns),
                "categorical_columns": len(df.select_dtypes(include=['object', 'category']).columns),
                "datetime_columns": len(df.select_dtypes(include=['datetime64']).columns)
            },
            "duplicates": {
                "count": df.duplicated().sum(),
                "percentage": (df.duplicated().sum() / len(df)) * 100 if len(df) > 0 else 0
            }
        }

        return quality



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

    def get_fallback_result(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback result when processing fails"""
        return self._format_output({
            "error": "Data profiling failed",
            "statistical_summary": {"row_count": 0, "column_count": 0, "columns": {}},
            "correlations": [],
            "patterns": {},
            "data_quality": {"completeness": 0}
        }, success=False)