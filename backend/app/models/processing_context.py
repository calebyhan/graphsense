"""
Processing Context - Efficient data sharing between agents
"""

import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import psutil
import os

logger = logging.getLogger(__name__)


@dataclass
class ProcessingContext:
    """
    Shared processing context for efficient data sharing between agents.
    Focuses on single responsibility: data sharing and basic caching.
    """
    
    # Core data
    dataset_id: str
    sample_data: pd.DataFrame
    original_size: int
    
    # Cached computations
    _computation_cache: Dict[str, Any] = field(default_factory=dict)
    
    # Column metadata cache
    _column_metadata: Optional[Dict[str, Any]] = field(default=None)
    
    # Memory tracking
    _creation_time: datetime = field(default_factory=datetime.now)
    _memory_usage_mb: float = field(default=0.0)
    
    def __post_init__(self):
        """Initialize context after creation"""
        self._update_memory_usage()
        logger.info(f"Created ProcessingContext for dataset {self.dataset_id} with {len(self.sample_data)} rows")
    
    def cache_computation(self, key: str, value: Any) -> None:
        """Cache a computation result for reuse between agents"""
        try:
            self._computation_cache[key] = value
            self._update_memory_usage()
            logger.debug(f"Cached computation '{key}' for dataset {self.dataset_id}")
        except Exception as e:
            logger.warning(f"Failed to cache computation '{key}': {e}")
    
    def get_cached_computation(self, key: str) -> Optional[Any]:
        """Retrieve a cached computation result"""
        return self._computation_cache.get(key)
    
    def has_cached_computation(self, key: str) -> bool:
        """Check if a computation is cached"""
        return key in self._computation_cache
    
    def get_column_types(self) -> Dict[str, str]:
        """Get column data types with caching"""
        if self._column_metadata is None:
            self._build_column_metadata()
        return self._column_metadata.get("types", {})
    
    def get_numeric_columns(self) -> List[str]:
        """Get list of numeric columns with caching"""
        if self._column_metadata is None:
            self._build_column_metadata()
        return self._column_metadata.get("numeric", [])
    
    def get_categorical_columns(self) -> List[str]:
        """Get list of categorical columns with caching"""
        if self._column_metadata is None:
            self._build_column_metadata()
        return self._column_metadata.get("categorical", [])
    
    def get_temporal_columns(self) -> List[str]:
        """Get list of temporal columns with caching"""
        if self._column_metadata is None:
            self._build_column_metadata()
        return self._column_metadata.get("temporal", [])
    
    def get_text_columns(self) -> List[str]:
        """Get list of text columns with caching"""
        if self._column_metadata is None:
            self._build_column_metadata()
        return self._column_metadata.get("text", [])
    
    def _build_column_metadata(self) -> None:
        """Build and cache column metadata"""
        try:
            metadata = {
                "types": {},
                "numeric": [],
                "categorical": [],
                "temporal": [],
                "text": []
            }
            
            logger.info(f"Building column metadata for {len(self.sample_data.columns)} columns: {list(self.sample_data.columns)}")
            
            for column in self.sample_data.columns:
                series = self.sample_data[column]
                data_type = self._infer_data_type(series)
                
                metadata["types"][column] = data_type
                
                if data_type == "numeric":
                    metadata["numeric"].append(column)
                elif data_type == "categorical":
                    metadata["categorical"].append(column)
                elif data_type == "temporal":
                    metadata["temporal"].append(column)
                else:
                    metadata["text"].append(column)
                
                logger.debug(f"Column '{column}': {data_type} (nunique={series.nunique()}, dtype={series.dtype})")
            
            self._column_metadata = metadata
            logger.info(f"Column metadata built - numeric: {len(metadata['numeric'])}, categorical: {len(metadata['categorical'])}, temporal: {len(metadata['temporal'])}, text: {len(metadata['text'])}")
            
        except Exception as e:
            logger.error(f"Failed to build column metadata: {e}")
            self._column_metadata = {
                "types": {},
                "numeric": [],
                "categorical": [],
                "temporal": [],
                "text": []
            }
    
    def _infer_data_type(self, series: pd.Series) -> str:
        """Infer data type for a pandas Series"""
        try:
            if pd.api.types.is_numeric_dtype(series):
                return "numeric"
            elif pd.api.types.is_datetime64_any_dtype(series):
                return "temporal"
            elif pd.api.types.is_bool_dtype(series):
                return "categorical"  # Treat boolean as categorical
            elif series.nunique() < 50 and series.nunique() / len(series) < 0.5:
                return "categorical"
            else:
                return "text"
        except Exception:
            return "text"  # Default fallback
    
    def estimate_memory_usage(self) -> float:
        """Estimate current memory usage in MB"""
        try:
            # DataFrame memory usage
            df_memory = self.sample_data.memory_usage(deep=True).sum() / (1024 * 1024)
            
            # Cache memory usage (rough estimate)
            cache_memory = 0.0
            for value in self._computation_cache.values():
                if isinstance(value, pd.DataFrame):
                    cache_memory += value.memory_usage(deep=True).sum() / (1024 * 1024)
                elif isinstance(value, (list, dict)):
                    cache_memory += 0.001  # Small estimate for basic structures
            
            total_memory = df_memory + cache_memory
            return round(total_memory, 2)
            
        except Exception as e:
            logger.warning(f"Failed to estimate memory usage: {e}")
            return 0.0
    
    def _update_memory_usage(self) -> None:
        """Update internal memory usage tracking"""
        self._memory_usage_mb = self.estimate_memory_usage()
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get processing statistics for monitoring"""
        return {
            "dataset_id": self.dataset_id,
            "sample_rows": len(self.sample_data),
            "sample_columns": len(self.sample_data.columns),
            "original_size": self.original_size,
            "cached_computations": len(self._computation_cache),
            "memory_usage_mb": self._memory_usage_mb,
            "processing_time_seconds": (datetime.now() - self._creation_time).total_seconds()
        }
    
    def cleanup(self) -> None:
        """Clean up resources and free memory"""
        try:
            # Clear computation cache
            self._computation_cache.clear()
            
            # Clear column metadata
            self._column_metadata = None
            
            # Clear DataFrame if it's large
            if len(self.sample_data) > 1000:
                self.sample_data = self.sample_data.iloc[:100].copy()  # Keep small sample
            
            self._update_memory_usage()
            logger.info(f"Cleaned up ProcessingContext for dataset {self.dataset_id}")
            
        except Exception as e:
            logger.error(f"Failed to cleanup ProcessingContext: {e}")
    
    @classmethod
    def create_from_data(
        cls, 
        dataset_id: str, 
        data: List[Dict[str, Any]], 
        max_sample_size: int = 5000
    ) -> 'ProcessingContext':
        """
        Create ProcessingContext from raw data with intelligent sampling
        """
        try:
            # Convert to DataFrame
            df = pd.DataFrame(data)
            original_size = len(df)
            
            # Apply intelligent sampling for large datasets
            if len(df) > max_sample_size:
                # Use stratified sampling if possible, otherwise random
                sample_df = df.sample(n=max_sample_size, random_state=42)
                logger.info(f"Sampled {max_sample_size} rows from {original_size} for processing")
            else:
                sample_df = df.copy()
            
            return cls(
                dataset_id=dataset_id,
                sample_data=sample_df,
                original_size=original_size
            )
            
        except Exception as e:
            logger.error(f"Failed to create ProcessingContext: {e}")
            raise ValueError(f"Failed to create processing context: {e}")
    
    def get_system_memory_info(self) -> Dict[str, float]:
        """Get system memory information for monitoring"""
        try:
            memory = psutil.virtual_memory()
            return {
                "total_gb": round(memory.total / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2),
                "used_percent": memory.percent,
                "process_memory_mb": round(psutil.Process(os.getpid()).memory_info().rss / (1024**2), 2)
            }
        except Exception as e:
            logger.warning(f"Failed to get system memory info: {e}")
            return {}
