#!/usr/bin/env python3
"""
Test script for the intelligent caching system
"""

import asyncio
import json
import logging
import sys
import os
from typing import List, Dict, Any

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.utils.intelligent_cache import get_intelligent_cache, DataFingerprintGenerator
from app.models.analysis import ComprehensiveDataAnalysis, ChartRecommendation
from app.models.base import ChartType

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_sample_data() -> List[Dict[str, Any]]:
    """Create sample dataset for testing"""
    return [
        {"name": "Alice", "age": 25, "salary": 50000, "department": "Engineering"},
        {"name": "Bob", "age": 30, "salary": 60000, "department": "Engineering"},
        {"name": "Charlie", "age": 35, "salary": 70000, "department": "Marketing"},
        {"name": "Diana", "age": 28, "salary": 55000, "department": "Marketing"},
        {"name": "Eve", "age": 32, "salary": 65000, "department": "Sales"},
        {"name": "Frank", "age": 29, "salary": 58000, "department": "Sales"},
        {"name": "Grace", "age": 27, "salary": 52000, "department": "Engineering"},
        {"name": "Henry", "age": 31, "salary": 62000, "department": "Marketing"},
        {"name": "Ivy", "age": 26, "salary": 51000, "department": "Sales"},
        {"name": "Jack", "age": 33, "salary": 67000, "department": "Engineering"}
    ]


def create_similar_data() -> List[Dict[str, Any]]:
    """Create similar dataset with same structure but different values"""
    return [
        {"name": "John", "age": 24, "salary": 49000, "department": "Engineering"},
        {"name": "Jane", "age": 29, "salary": 59000, "department": "Engineering"},
        {"name": "Mike", "age": 34, "salary": 69000, "department": "Marketing"},
        {"name": "Sarah", "age": 27, "salary": 54000, "department": "Marketing"},
        {"name": "Tom", "age": 31, "salary": 64000, "department": "Sales"},
        {"name": "Lisa", "age": 28, "salary": 57000, "department": "Sales"},
        {"name": "David", "age": 26, "salary": 51000, "department": "Engineering"},
        {"name": "Emma", "age": 30, "salary": 61000, "department": "Marketing"},
        {"name": "Ryan", "age": 25, "salary": 50000, "department": "Sales"},
        {"name": "Anna", "age": 32, "salary": 66000, "department": "Engineering"}
    ]


def create_different_data() -> List[Dict[str, Any]]:
    """Create dataset with different structure"""
    return [
        {"product": "Widget A", "price": 10.99, "category": "Electronics", "in_stock": True},
        {"product": "Widget B", "price": 15.99, "category": "Electronics", "in_stock": False},
        {"product": "Gadget X", "price": 25.99, "category": "Home", "in_stock": True},
        {"product": "Gadget Y", "price": 30.99, "category": "Home", "in_stock": True},
        {"product": "Tool Z", "price": 45.99, "category": "Tools", "in_stock": False}
    ]


async def test_data_fingerprinting():
    """Test data fingerprinting functionality"""
    logger.info("Testing data fingerprinting...")
    
    cache = get_intelligent_cache()
    
    # Test with sample data
    data1 = create_sample_data()
    data2 = create_similar_data()  # Similar structure, different values
    data3 = create_different_data()  # Different structure
    
    fingerprint1 = cache.get_data_fingerprint(data1)
    fingerprint2 = cache.get_data_fingerprint(data2)
    fingerprint3 = cache.get_data_fingerprint(data3)
    
    logger.info(f"Fingerprint 1 (sample data): {fingerprint1}")
    logger.info(f"Fingerprint 2 (similar data): {fingerprint2}")
    logger.info(f"Fingerprint 3 (different data): {fingerprint3}")
    
    # Similar data should have same fingerprint (same structure and similar stats)
    if fingerprint1 == fingerprint2:
        logger.info("✅ Similar data produces same fingerprint")
    else:
        logger.info("ℹ️ Similar data produces different fingerprint (expected due to statistical differences)")
    
    # Different data should have different fingerprint
    assert fingerprint1 != fingerprint3, "Different data should have different fingerprints"
    assert fingerprint2 != fingerprint3, "Different data should have different fingerprints"
    logger.info("✅ Different data produces different fingerprints")


async def test_ai_response_caching():
    """Test AI response caching"""
    logger.info("Testing AI response caching...")
    
    cache = get_intelligent_cache()
    
    # Test prompt and response
    test_prompt = "Analyze this dataset and provide insights"
    test_context = {"columns": ["name", "age", "salary"], "rows": 10}
    test_response = {
        "insights": ["Age distribution is normal", "Salary correlates with age"],
        "recommendations": ["Use scatter plot", "Consider bar chart"]
    }
    
    # Generate prompt hash
    prompt_hash = cache.generate_prompt_hash(test_prompt, test_context)
    logger.info(f"Generated prompt hash: {prompt_hash}")
    
    # Test cache miss
    cached_response = cache.get_cached_ai_response(prompt_hash)
    assert cached_response is None, "Should be cache miss initially"
    logger.info("✅ Cache miss works correctly")
    
    # Cache the response
    cache.cache_ai_response(prompt_hash, test_response)
    logger.info("✅ Response cached successfully")
    
    # Test cache hit
    cached_response = cache.get_cached_ai_response(prompt_hash)
    assert cached_response == test_response, "Cached response should match original"
    logger.info("✅ Cache hit works correctly")


async def test_analysis_caching():
    """Test analysis result caching"""
    logger.info("Testing analysis result caching...")
    
    cache = get_intelligent_cache()
    
    # Create mock analysis
    test_analysis = ComprehensiveDataAnalysis(
        dataset_id="test-123",
        statistical_summary={"rows": 10, "columns": 4},
        patterns={"trend": "increasing"},
        data_quality={"completeness": 0.95},
        processing_time_ms=1500
    )
    
    test_fingerprint = "test_fingerprint_123"
    
    # Test cache miss
    cached_analysis = cache.get_cached_analysis(test_fingerprint)
    assert cached_analysis is None, "Should be cache miss initially"
    logger.info("✅ Analysis cache miss works correctly")
    
    # Cache the analysis
    cache.cache_analysis_result(test_fingerprint, test_analysis)
    logger.info("✅ Analysis cached successfully")
    
    # Test cache hit
    cached_analysis = cache.get_cached_analysis(test_fingerprint)
    assert cached_analysis is not None, "Should have cached analysis"
    assert cached_analysis.dataset_id == test_analysis.dataset_id, "Cached analysis should match"
    logger.info("✅ Analysis cache hit works correctly")


async def test_cache_metrics():
    """Test cache metrics and monitoring"""
    logger.info("Testing cache metrics...")
    
    cache = get_intelligent_cache()
    
    # Clear cache to start fresh
    cache.clear_cache()
    
    # Generate some cache activity
    test_data = create_sample_data()
    fingerprint = cache.get_data_fingerprint(test_data)  # This should be a miss
    
    # Generate AI response activity
    prompt_hash = cache.generate_prompt_hash("test prompt", {"test": "context"})
    cache.get_cached_ai_response(prompt_hash)  # Miss
    cache.cache_ai_response(prompt_hash, {"test": "response"})
    cache.get_cached_ai_response(prompt_hash)  # Hit
    
    # Get metrics
    metrics = cache.get_cache_metrics()
    cache_sizes = cache.get_cache_sizes()
    
    logger.info(f"Cache metrics: {json.dumps(metrics, indent=2)}")
    logger.info(f"Cache sizes: {cache_sizes}")
    
    # Verify metrics
    assert 'fingerprint' in metrics, "Should have fingerprint metrics"
    assert 'ai_response' in metrics, "Should have AI response metrics"
    assert metrics['ai_response']['hits'] > 0, "Should have recorded hits"
    assert metrics['ai_response']['misses'] > 0, "Should have recorded misses"
    
    logger.info("✅ Cache metrics work correctly")


async def test_cache_optimization():
    """Test cache optimization recommendations"""
    logger.info("Testing cache optimization...")
    
    cache = get_intelligent_cache()
    
    # Generate some activity for optimization analysis
    for i in range(20):
        test_prompt = f"test prompt {i}"
        prompt_hash = cache.generate_prompt_hash(test_prompt, {"iteration": i})
        cache.get_cached_ai_response(prompt_hash)  # All misses
    
    # Get optimization report
    optimization_report = cache.optimize_cache_performance()
    
    logger.info(f"Optimization report: {json.dumps(optimization_report, indent=2)}")
    
    assert 'recommendations' in optimization_report, "Should have recommendations"
    assert 'current_metrics' in optimization_report, "Should have current metrics"
    assert 'cache_sizes' in optimization_report, "Should have cache sizes"
    
    logger.info("✅ Cache optimization works correctly")


async def main():
    """Run all cache tests"""
    logger.info("🧪 Starting intelligent cache system tests...")
    
    try:
        await test_data_fingerprinting()
        await test_ai_response_caching()
        await test_analysis_caching()
        await test_cache_metrics()
        await test_cache_optimization()
        
        logger.info("🎉 All cache tests passed successfully!")
        
        # Print final cache status
        cache = get_intelligent_cache()
        final_metrics = cache.get_cache_metrics()
        final_sizes = cache.get_cache_sizes()
        
        logger.info("📊 Final cache status:")
        logger.info(f"Cache sizes: {final_sizes}")
        logger.info(f"Overall metrics: {json.dumps(final_metrics, indent=2)}")
        
    except Exception as e:
        logger.error(f"❌ Cache test failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())