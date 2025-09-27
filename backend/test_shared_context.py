#!/usr/bin/env python3
"""
Test script for shared data context between agents
"""

import asyncio
import pandas as pd
from datetime import datetime
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.models.processing_context import ProcessingContext
from app.agents.enhanced_profiler_agent import EnhancedDataProfilerAgent
from app.agents.chart_recommender_agent import ChartRecommenderAgent
from app.agents.validation_agent import ValidationAgent
from app.services.agent_pipeline import AgentPipelineService


async def test_shared_context():
    """Test the shared context implementation"""
    print("Testing shared data context between agents...")
    
    # Create sample data
    sample_data = [
        {"name": "Alice", "age": 25, "salary": 50000, "department": "Engineering"},
        {"name": "Bob", "age": 30, "salary": 60000, "department": "Marketing"},
        {"name": "Charlie", "age": 35, "salary": 70000, "department": "Engineering"},
        {"name": "Diana", "age": 28, "salary": 55000, "department": "Sales"},
        {"name": "Eve", "age": 32, "salary": 65000, "department": "Marketing"},
    ]
    
    # Test ProcessingContext creation
    print("\n1. Testing ProcessingContext creation...")
    df = pd.DataFrame(sample_data)
    context = ProcessingContext(
        dataset_id="test_dataset_001",
        original_data_size=len(sample_data),
        sample_data=df
    )
    
    print(f"Context created: {context.get_cache_summary()}")
    
    # Test caching functionality
    print("\n2. Testing caching functionality...")
    context.cache_statistic("test_stat", {"mean_age": 30.0})
    context.cache_column_metadata("age", {"data_type": "numeric", "mean": 30.0})
    context.cache_data_quality("completeness", 1.0)
    
    print(f"Cached statistic: {context.get_cached_statistic('test_stat')}")
    print(f"Cached column metadata: {context.get_column_metadata('age')}")
    print(f"Cached data quality: {context.get_cached_data_quality('completeness')}")
    
    # Test column type helpers
    print("\n3. Testing column type helpers...")
    context.cache_column_metadata("name", {"data_type": "categorical"})
    context.cache_column_metadata("salary", {"data_type": "numeric"})
    context.cache_column_metadata("department", {"data_type": "categorical"})
    
    print(f"Numeric columns: {context.get_numeric_columns()}")
    print(f"Categorical columns: {context.get_categorical_columns()}")
    print(f"Temporal columns: {context.get_temporal_columns()}")
    
    # Test memory usage tracking
    print("\n4. Testing memory usage tracking...")
    context.update_memory_usage()
    print(f"Memory usage: {context.memory_usage_bytes} bytes")
    
    print("\n5. Testing context-aware agent pipeline...")
    try:
        pipeline = AgentPipelineService()
        
        # Test the new context-aware analysis method
        result = await pipeline.analyze_dataset_with_shared_context(
            data=sample_data,
            dataset_id="test_dataset_001"
        )
        
        print(f"Pipeline completed successfully!")
        print(f"Processing time: {result.processing_time_ms}ms")
        print(f"Number of recommendations: {len(result.recommendations)}")
        print(f"Dataset ID: {result.dataset_id}")
        
        # Show some recommendation details
        if result.recommendations:
            first_rec = result.recommendations[0]
            print(f"Top recommendation: {first_rec.chart_type.value} (confidence: {first_rec.confidence:.2f})")
        
    except Exception as e:
        print(f"Pipeline test failed: {e}")
        import traceback
        traceback.print_exc()
    
    # Test cache clearing
    print("\n6. Testing cache clearing...")
    print(f"Cache summary before clearing: {context.get_cache_summary()}")
    context.clear_cache()
    print(f"Cache summary after clearing: {context.get_cache_summary()}")
    
    print("\nShared context test completed!")


if __name__ == "__main__":
    asyncio.run(test_shared_context())