"""
Enhanced Data Profiler Agent - Combines profiling, pattern recognition, and statistical analysis
"""

import json
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from scipy import stats
from sklearn.preprocessing import LabelEncoder
from datetime import datetime

from .base_agent import BaseAgent
from app.models.base import AgentType
from app.models.analysis import ComprehensiveDataAnalysis

logger = logging.getLogger(__name__)


class EnhancedDataProfilerAgent(BaseAgent):
    """Enhanced agent that combines data profiling, pattern recognition, and statistical analysis"""

    def __init__(self):
        super().__init__(AgentType.PROFILER)

    async def analyze(self, data: List[Dict[str, Any]]) -> ComprehensiveDataAnalysis:
        """Perform comprehensive data analysis"""
        try:
            start_time = datetime.now()

            # Convert to DataFrame for analysis
            df = pd.DataFrame(data)

            # Perform all analyses
            statistical_summary = self._statistical_analysis(df)
            correlations = self._correlation_analysis(df)
            patterns = self._pattern_analysis(df)
            data_quality = self._data_quality_analysis(df)
            temporal_patterns = self._temporal_analysis(df)

            # Generate AI insights using Gemini
            ai_insights = await self._generate_ai_insights(df, {
                "statistical_summary": statistical_summary,
                "correlations": correlations,
                "patterns": patterns,
                "data_quality": data_quality
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

    def _statistical_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Perform statistical analysis on the dataset"""
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

            for i, col1 in enumerate(numeric_cols):
                for j, col2 in enumerate(numeric_cols[i+1:], i+1):
                    correlation = corr_matrix.iloc[i, j]
                    if not pd.isna(correlation) and abs(correlation) > 0.1:  # Only significant correlations
                        correlations.append({
                            "column1": col1,
                            "column2": col2,
                            "correlation": float(correlation),
                            "strength": self._correlation_strength(correlation),
                            "type": "pearson"
                        })

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
        """Assess data quality"""
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
            }
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
        """Generate AI insights using Gemini"""
        try:
            prompt = f"""
            As a data analysis expert, provide insights for this dataset based on the following analysis:

            Dataset Overview:
            - Rows: {len(df)}
            - Columns: {len(df.columns)}
            - Column names: {list(df.columns)}

            Statistical Summary: {json.dumps(analysis_data['statistical_summary'], default=str, indent=2)}

            Provide insights in JSON format with the following structure:
            {{
                "key_insights": ["insight1", "insight2", ...],
                "data_characteristics": "brief description",
                "recommended_analysis_approaches": ["approach1", "approach2", ...],
                "potential_visualizations": ["viz1", "viz2", ...],
                "data_quality_assessment": "brief assessment"
            }}
            """

            response = await self.generate_response(
                prompt,
                context={"dataset_preview": df.head().to_dict()},
                system_instruction="You are an expert data analyst. Provide concise, actionable insights in valid JSON format."
            )

            # Parse JSON response using the base agent's extraction method
            json_response = self.extract_json_from_response(response)
            
            if json_response:
                return json_response
            else:
                logger.warning("Failed to parse AI insights as JSON, returning raw response")
                return {"raw_insights": response}

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