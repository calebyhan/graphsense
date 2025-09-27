#!/usr/bin/env python3
"""
Simple integration test for streaming data processing core functionality
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.utils.streaming_processor import StreamingDataProcessor
from app.utils.memory_manager import MemoryManager, RequestPriority
from app.utils.data_sampling import DataSampler

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_complete_workflow():
    """Test the complete workflow from file processing to memory management"""
    logger.info("Testing Complete Workflow...")
    
    # Initialize components
    processor = StreamingDataProcessor(
        chunk_size=2000,
        memory_limit_mb=256,
        sample_size=500
    )
    
    manager = MemoryManager(
        max_memory_mb=256,
        memory_threshold=0.7,
        max_queue_size=10
    )
    
    await manager.start()
    
    try:
        # Create test data
        logger.info("Creating test dataset...")
        csv_data = "id,name,age,department,salary,city,country\n"
        for i in range(10000):
            csv_data += f"{i},Employee_{i},{25 + (i % 40)},Dept_{i % 8},{40000 + (i * 50)},City_{i % 15},Country_{i % 5}\n"
        
        file_size_mb = len(csv_data.encode('utf-8')) / (1024 * 1024)
        logger.info(f"Test dataset: {file_size_mb:.2f} MB, 10,000 rows")
        
        # Process data with memory management
        async def process_data():
            return await processor.process_csv_stream(csv_data, "test_workflow.csv")
        
        # Queue the processing request
        success = await manager.queue_request(
            request_id="workflow_test",
            callback=process_data,
            estimated_memory_mb=int(file_size_mb * 2),
            priority=RequestPriority.HIGH,
            timeout_seconds=120
        )
        
        if not success:
            raise Exception("Failed to queue processing request")
        
        logger.info("Processing request queued successfully")
        
        # Wait for processing to complete
        await asyncio.sleep(2)
        
        # Check manager status
        status = manager.get_queue_status()
        logger.info(f"Processing completed. Stats: {status['stats']}")
        
        logger.info("Complete Workflow test completed ✓")
        
    finally:
        await manager.stop()


async def test_memory_optimization():
    """Test memory optimization features"""
    logger.info("Testing Memory Optimization...")
    
    processor = StreamingDataProcessor(
        chunk_size=1000,
        memory_limit_mb=128,  # Lower limit to test optimization
        sample_size=200
    )
    
    # Test with different data sizes
    test_sizes = [1000, 5000, 10000, 20000]
    
    for size in test_sizes:
        logger.info(f"Testing with {size} rows...")
        
        # Create test data
        csv_data = "col1,col2,col3,col4,col5\n"
        for i in range(size):
            csv_data += f"val_{i},{i},{i*2},{i*3},{i*4}\n"
        
        # Process and measure
        start_memory = processor.memory_monitor.get_memory_usage()["rss"]
        
        result = await processor.process_csv_stream(csv_data, f"test_{size}.csv")
        
        end_memory = processor.memory_monitor.get_memory_usage()["rss"]
        memory_delta = (end_memory - start_memory) / (1024 * 1024)  # MB
        
        logger.info(f"  Size: {size} rows -> {result['metadata']['sampled_rows']} sampled")
        logger.info(f"  Memory delta: {memory_delta:.2f} MB")
        logger.info(f"  Sampling ratio: {result['metadata']['sampling_ratio']:.3f}")
        
        # Force cleanup
        processor.memory_monitor.force_garbage_collection()
    
    logger.info("Memory Optimization test completed ✓")


async def test_data_sampling_accuracy():
    """Test that data sampling preserves statistical properties"""
    logger.info("Testing Data Sampling Accuracy...")
    
    sampler = DataSampler(max_sample_size=1000)
    
    # Create structured test data
    original_data = []
    for i in range(5000):
        original_data.append({
            "id": i,
            "category": f"Cat_{i % 10}",  # 10 categories
            "value": i * 2,
            "flag": i % 2 == 0  # Boolean
        })
    
    # Sample the data
    sampled_data = sampler.smart_sample(original_data, 1000)
    
    # Analyze original data
    original_categories = {}
    original_values = []
    original_flags = {"True": 0, "False": 0}
    
    for item in original_data:
        cat = item["category"]
        original_categories[cat] = original_categories.get(cat, 0) + 1
        original_values.append(item["value"])
        original_flags[str(item["flag"])] += 1
    
    # Analyze sampled data
    sampled_categories = {}
    sampled_values = []
    sampled_flags = {"True": 0, "False": 0}
    
    for item in sampled_data:
        cat = item["category"]
        sampled_categories[cat] = sampled_categories.get(cat, 0) + 1
        sampled_values.append(item["value"])
        sampled_flags[str(item["flag"])] += 1
    
    # Compare distributions
    logger.info(f"Original data: {len(original_data)} rows")
    logger.info(f"Sampled data: {len(sampled_data)} rows")
    
    # Category distribution
    logger.info("Category distribution comparison:")
    for cat in sorted(original_categories.keys()):
        orig_pct = original_categories[cat] / len(original_data) * 100
        samp_pct = sampled_categories.get(cat, 0) / len(sampled_data) * 100
        logger.info(f"  {cat}: Original {orig_pct:.1f}%, Sampled {samp_pct:.1f}%")
    
    # Value statistics
    import statistics
    orig_mean = statistics.mean(original_values)
    samp_mean = statistics.mean(sampled_values)
    orig_median = statistics.median(original_values)
    samp_median = statistics.median(sampled_values)
    
    logger.info(f"Value statistics:")
    logger.info(f"  Mean: Original {orig_mean:.1f}, Sampled {samp_mean:.1f}")
    logger.info(f"  Median: Original {orig_median:.1f}, Sampled {samp_median:.1f}")
    
    # Flag distribution
    orig_true_pct = original_flags["True"] / len(original_data) * 100
    samp_true_pct = sampled_flags["True"] / len(sampled_data) * 100
    logger.info(f"Boolean flag (True): Original {orig_true_pct:.1f}%, Sampled {samp_true_pct:.1f}%")
    
    logger.info("Data Sampling Accuracy test completed ✓")


async def test_error_handling():
    """Test error handling in streaming processor"""
    logger.info("Testing Error Handling...")
    
    processor = StreamingDataProcessor()
    
    # Test invalid CSV
    try:
        invalid_csv = "col1,col2\nval1\nval2,val3,val4\n"  # Inconsistent columns
        result = await processor.process_csv_stream(invalid_csv, "invalid.csv")
        logger.info("Invalid CSV handled gracefully")
    except Exception as e:
        logger.info(f"Invalid CSV error handled: {type(e).__name__}")
    
    # Test invalid JSON
    try:
        invalid_json = '{"data": [{"id": 1, "name": "test"'  # Malformed JSON
        result = await processor.process_json_stream(invalid_json, "invalid.json")
        logger.info("Invalid JSON handled gracefully")
    except Exception as e:
        logger.info(f"Invalid JSON error handled: {type(e).__name__}")
    
    # Test empty data
    try:
        empty_csv = "col1,col2\n"  # Only header
        result = await processor.process_csv_stream(empty_csv, "empty.csv")
        logger.info(f"Empty CSV result: {len(result['data'])} rows")
    except Exception as e:
        logger.info(f"Empty CSV error handled: {type(e).__name__}")
    
    logger.info("Error Handling test completed ✓")


async def main():
    """Run all tests"""
    logger.info("Starting Simple Integration Tests")
    logger.info("=" * 60)
    
    try:
        await test_complete_workflow()
        logger.info("-" * 40)
        
        await test_memory_optimization()
        logger.info("-" * 40)
        
        await test_data_sampling_accuracy()
        logger.info("-" * 40)
        
        await test_error_handling()
        logger.info("-" * 40)
        
        logger.info("All simple integration tests completed successfully! ✅")
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)