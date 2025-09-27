"""
Processing Context - Shared data context between agents to avoid redundant calculations
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
import pandas as pd
from datetime import datetime

from app.models.analysis import ComprehensiveDataAnalysis


@dataclass
class ProcessingContext:
    """
    Shared context between agents to pass data references and avoid copying.
    This class maintains statistical summaries and intermediate results that can be
    reused across the agent pipeline.
    """
    
    # Core dataset information
    dataset_id: str
    original_data_size: int
    sample_data: pd.DataFrame
    
    # Cached statistical computations
    statistical_cache: Dict[str, Any] = field(default_factory=dict)
    correlation_cache: Optional[pd.DataFrame] = None
    pattern_cache: Dict[str, Any] = field(default_factory=dict)
    
    # Data quality metrics (computed once, reused)
    data_quality_cache: Dict[str, Any] = field(default_factory=dict)
    
    # Column metadata (computed once, reused)
    column_metadata: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    # Memory usage tracking
    memory_usage_bytes: int = 0
    
    # Processing metadata
    created_at: datetime = field(default_factory=datetime.now)
    last_updated: datetime = field(default_factory=datetime.now)
    
    # Agent results cache to avoid recomputation
    profiler_results: Optional[ComprehensiveDataAnalysis] = None
    
    def update_memory_usage(self, additional_bytes: int = 0) -> None:
        """Update memory usage tracking"""
        if additional_bytes > 0:
            self.memory_usage_bytes += additional_bytes
        else:
            # Estimate current memory usage
            self.memory_usage_bytes = (
                self.sample_data.memory_usage(deep=True).sum() +
                len(str(self.statistical_cache)) +
                len(str(self.pattern_cache)) +
                len(str(self.data_quality_cache)) +
                len(str(self.column_metadata))
            )
        
        self.last_updated = datetime.now()
    
    def get_cached_statistic(self, key: str) -> Optional[Any]:
        """Get a cached statistical computation"""
        return self.statistical_cache.get(key)
    
    def cache_statistic(self, key: str, value: Any) -> None:
        """Cache a statistical computation for reuse"""
        self.statistical_cache[key] = value
        self.last_updated = datetime.now()
    
    def get_cached_correlation(self) -> Optional[pd.DataFrame]:
        """Get cached correlation matrix"""
        return self.correlation_cache
    
    def cache_correlation(self, correlation_matrix: pd.DataFrame) -> None:
        """Cache correlation matrix for reuse"""
        self.correlation_cache = correlation_matrix
        self.last_updated = datetime.now()
    
    def get_cached_pattern(self, pattern_type: str) -> Optional[Any]:
        """Get a cached pattern analysis result"""
        return self.pattern_cache.get(pattern_type)
    
    def cache_pattern(self, pattern_type: str, pattern_data: Any) -> None:
        """Cache pattern analysis result"""
        self.pattern_cache[pattern_type] = pattern_data
        self.last_updated = datetime.now()
    
    def get_cached_data_quality(self, metric: str) -> Optional[Any]:
        """Get a cached data quality metric"""
        return self.data_quality_cache.get(metric)
    
    def cache_data_quality(self, metric: str, value: Any) -> None:
        """Cache data quality metric"""
        self.data_quality_cache[metric] = value
        self.last_updated = datetime.now()
    
    def get_column_metadata(self, column: str) -> Optional[Dict[str, Any]]:
        """Get cached column metadata"""
        return self.column_metadata.get(column)
    
    def cache_column_metadata(self, column: str, metadata: Dict[str, Any]) -> None:
        """Cache column metadata"""
        self.column_metadata[column] = metadata
        self.last_updated = datetime.now()
    
    def get_numeric_columns(self) -> List[str]:
        """Get list of numeric columns from cached metadata"""
        return [
            col for col, meta in self.column_metadata.items()
            if meta.get("data_type") == "numeric"
        ]
    
    def get_categorical_columns(self) -> List[str]:
        """Get list of categorical columns from cached metadata"""
        return [
            col for col, meta in self.column_metadata.items()
            if meta.get("data_type") == "categorical"
        ]
    
    def get_temporal_columns(self) -> List[str]:
        """Get list of temporal columns from cached metadata"""
        return [
            col for col, meta in self.column_metadata.items()
            if meta.get("data_type") == "temporal"
        ]
    
    def clear_cache(self) -> None:
        """Clear all cached data to free memory"""
        self.statistical_cache.clear()
        self.correlation_cache = None
        self.pattern_cache.clear()
        self.data_quality_cache.clear()
        self.column_metadata.clear()
        self.profiler_results = None
        self.memory_usage_bytes = 0
        self.last_updated = datetime.now()
    
    def get_cache_summary(self) -> Dict[str, Any]:
        """Get summary of cached data for debugging/monitoring"""
        return {
            "dataset_id": self.dataset_id,
            "sample_size": len(self.sample_data),
            "original_size": self.original_data_size,
            "cached_statistics": len(self.statistical_cache),
            "has_correlation_cache": self.correlation_cache is not None,
            "cached_patterns": len(self.pattern_cache),
            "cached_quality_metrics": len(self.data_quality_cache),
            "cached_columns": len(self.column_metadata),
            "memory_usage_bytes": self.memory_usage_bytes,
            "has_profiler_results": self.profiler_results is not None,
            "created_at": self.created_at.isoformat(),
            "last_updated": self.last_updated.isoformat()
        }