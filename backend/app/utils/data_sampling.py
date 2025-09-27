"""
Data Sampling Utilities for Performance Optimization
"""

import random
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class DataSampler:
    """Utility class for efficient data sampling"""
    
    def __init__(self, max_sample_size: int = 5000, random_seed: int = 42):
        """
        Initialize DataSampler
        
        Args:
            max_sample_size: Maximum number of rows to sample
            random_seed: Random seed for reproducible sampling
        """
        self.max_sample_size = max_sample_size
        self.random_seed = random_seed
        random.seed(random_seed)
        np.random.seed(random_seed)
    
    def reservoir_sample(self, data: List[Dict[str, Any]], sample_size: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Implement reservoir sampling algorithm for representative data samples
        
        Args:
            data: Input data as list of dictionaries
            sample_size: Number of samples to return (defaults to max_sample_size)
            
        Returns:
            Sampled data maintaining statistical properties
        """
        if sample_size is None:
            sample_size = self.max_sample_size
            
        # If data is smaller than sample size, return all data
        if len(data) <= sample_size:
            logger.info(f"Dataset size ({len(data)}) <= sample size ({sample_size}), returning full dataset")
            return data
        
        logger.info(f"Applying reservoir sampling: {len(data)} -> {sample_size} rows")
        
        # Initialize reservoir with first sample_size elements
        reservoir = data[:sample_size]
        
        # Process remaining elements
        for i in range(sample_size, len(data)):
            # Generate random index between 0 and i (inclusive)
            j = random.randint(0, i)
            
            # If j is within reservoir size, replace element at j
            if j < sample_size:
                reservoir[j] = data[i]
        
        return reservoir
    
    def stratified_sample(self, df: pd.DataFrame, strata_column: str, sample_size: Optional[int] = None) -> pd.DataFrame:
        """
        Perform stratified sampling to maintain proportions of categorical variables
        
        Args:
            df: Input DataFrame
            strata_column: Column to use for stratification
            sample_size: Total number of samples to return
            
        Returns:
            Stratified sample DataFrame
        """
        if sample_size is None:
            sample_size = self.max_sample_size
            
        if len(df) <= sample_size:
            return df
        
        # Get value counts for stratification
        strata_counts = df[strata_column].value_counts()
        strata_proportions = strata_counts / len(df)
        
        sampled_dfs = []
        
        for stratum, proportion in strata_proportions.items():
            stratum_data = df[df[strata_column] == stratum]
            stratum_sample_size = max(1, int(sample_size * proportion))
            
            if len(stratum_data) <= stratum_sample_size:
                sampled_dfs.append(stratum_data)
            else:
                sampled_dfs.append(stratum_data.sample(n=stratum_sample_size, random_state=self.random_seed))
        
        result = pd.concat(sampled_dfs, ignore_index=True)
        
        # If we're over the target, randomly sample down
        if len(result) > sample_size:
            result = result.sample(n=sample_size, random_state=self.random_seed)
        
        logger.info(f"Stratified sampling on '{strata_column}': {len(df)} -> {len(result)} rows")
        return result
    
    def smart_sample(self, data: List[Dict[str, Any]], sample_size: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Intelligent sampling that preserves data characteristics
        
        Args:
            data: Input data as list of dictionaries
            sample_size: Number of samples to return
            
        Returns:
            Intelligently sampled data
        """
        if sample_size is None:
            sample_size = self.max_sample_size
            
        if len(data) <= sample_size:
            return data
        
        df = pd.DataFrame(data)
        
        # Try to find a good stratification column
        categorical_cols = []
        for col in df.columns:
            if df[col].dtype == 'object' or df[col].dtype.name == 'category':
                unique_count = df[col].nunique()
                # Good stratification column: not too many unique values, not too few
                if 2 <= unique_count <= min(20, len(df) // 10):
                    categorical_cols.append((col, unique_count))
        
        # Use stratified sampling if we have a good categorical column
        if categorical_cols:
            # Choose column with moderate number of categories
            best_col = min(categorical_cols, key=lambda x: abs(x[1] - 5))[0]
            sampled_df = self.stratified_sample(df, best_col, sample_size)
            return sampled_df.to_dict('records')
        
        # Fall back to reservoir sampling
        return self.reservoir_sample(data, sample_size)
    
    def get_sampling_metadata(self, original_size: int, sampled_size: int) -> Dict[str, Any]:
        """
        Generate metadata about the sampling process
        
        Args:
            original_size: Size of original dataset
            sampled_size: Size of sampled dataset
            
        Returns:
            Sampling metadata
        """
        return {
            "original_size": original_size,
            "sampled_size": sampled_size,
            "sampling_ratio": sampled_size / original_size if original_size > 0 else 0,
            "is_sampled": sampled_size < original_size,
            "sampling_method": "reservoir" if sampled_size < original_size else "none"
        }


def calculate_significance_threshold(sample_size: int, confidence_level: float = 0.95) -> float:
    """
    Calculate correlation significance threshold based on sample size
    
    Args:
        sample_size: Size of the sample
        confidence_level: Confidence level for significance testing
        
    Returns:
        Minimum correlation coefficient for significance
    """
    from scipy import stats
    
    # Degrees of freedom for correlation
    df = sample_size - 2
    
    if df <= 0:
        return 0.5  # Conservative threshold for very small samples
    
    # Critical t-value for given confidence level
    alpha = 1 - confidence_level
    t_critical = stats.t.ppf(1 - alpha/2, df)
    
    # Convert to correlation coefficient threshold
    r_threshold = t_critical / np.sqrt(df + t_critical**2)
    
    return abs(r_threshold)