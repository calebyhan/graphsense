#!/usr/bin/env python3
"""
Test script for streaming data processor and memory management
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.utils.streaming_processor import StreamingDataProcessor, MemoryMonitor
from app.utils.memory_manager import MemoryManager, RequestPriority

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_memory_monitor():
    """Test memory monitoring functionality"""
    logger.info("Testing Memory Monitor...")
    
    monitor = MemoryMonitor(memory_limit_mb=256)
    
    # Get memory usage
    usage = monitor.get_memory_usage()
    logger.info(f"Current memory usage: {usage}")
    
    # Check memory pressure
    pressure = monitor.get_memory_pressure()
    logger.info(f"Memory pressure: {pressure:.2%}")
    
    # Test memory availability check
    available = monitor.is_memory_available(50 * 1024 * 1024)  # 50MB
    logger.info(f"50MB available: {available}")
    
    # Force garbage collection
    collected = monitor.force_garbage_collection()
    logger.info(f"Garbage collection freed {collected} objects")
    
    logger.info("Memory Monitor test completed ✓")


async def test_streaming_processor():
    """Test streaming data processor with sample CSV data"""
    logger.info("Testing Streaming Data Processor...")
    
    processor = StreamingDataProcessor(
        chunk_size=1000,
        memory_limit_mb=256,
        sample_size=500
    )
    
    # Create sample CSV data
    csv_data = "name,age,city,salary\n"
    for i in range(5000):
        csv_data += f"Person_{i},{20 + (i % 50)},City_{i % 10},{30000 + (i * 100)}\n"
    
    logger.info(f"Created sample CSV with {len(csv_data.split(chr(10))) - 1} rows")
    
    # Process the CSV data
    result = await processor.process_csv_stream(csv_data, "test_data.csv")
    
    logger.info(f"Processing result:")
    logger.info(f"  - Original rows: {result['metadata']['original_rows']}")
    logger.info(f"  - Sampled rows: {result['metadata']['sampled_rows']}")
    logger.info(f"  - Sampling ratio: {result['metadata']['sampling_ratio']:.3f}")
    logger.info(f"  - File size: {result['metadata']['file_size_mb']:.2f} MB")
    logger.info(f"  - Processing method: {result['metadata']['processing_method']}")
    
    # Check processing stats
    stats = result['processing_stats']
    logger.info(f"Processing stats:")
    logger.info(f"  - Chunks processed: {stats['chunks_processed']}")
    logger.info(f"  - Total rows processed: {stats['total_rows_processed']}")
    logger.info(f"  - Memory peak: {stats['memory_peak'] / (1024*1024):.2f} MB")
    logger.info(f"  - GC collections: {stats['gc_collections']}")
    
    # Verify data structure
    if result['data']:
        sample_row = result['data'][0]
        logger.info(f"Sample row keys: {list(sample_row.keys())}")
        logger.info(f"Sample row: {sample_row}")
    
    logger.info("Streaming Data Processor test completed ✓")


async def test_memory_manager():
    """Test memory manager and request queuing"""
    logger.info("Testing Memory Manager...")
    
    manager = MemoryManager(
        max_memory_mb=256,
        memory_threshold=0.8,
        max_queue_size=10
    )
    
    await manager.start()
    
    try:
        # Test memory usage reporting
        usage = manager.get_memory_usage()
        logger.info(f"Memory usage: {usage}")
        
        # Test queue status
        status = manager.get_queue_status()
        logger.info(f"Queue status: {status}")
        
        # Test request queuing
        async def dummy_task():
            logger.info("Executing dummy task...")
            await asyncio.sleep(0.1)
            return "Task completed"
        
        # Queue a few requests
        for i in range(3):
            success = await manager.queue_request(
                request_id=f"test_request_{i}",
                callback=dummy_task,
                estimated_memory_mb=10,
                priority=RequestPriority.NORMAL
            )
            logger.info(f"Request {i} queued: {success}")
        
        # Wait a bit for processing
        await asyncio.sleep(2)
        
        # Check final status
        final_status = manager.get_queue_status()
        logger.info(f"Final queue status: {final_status}")
        
    finally:
        await manager.stop()
    
    logger.info("Memory Manager test completed ✓")


async def test_json_processing():
    """Test JSON processing"""
    logger.info("Testing JSON Processing...")
    
    processor = StreamingDataProcessor(sample_size=100)
    
    # Create sample JSON data
    json_data = {
        "data": [
            {"id": i, "name": f"Item_{i}", "value": i * 10, "category": f"Cat_{i % 5}"}
            for i in range(1000)
        ]
    }
    
    import json
    json_str = json.dumps(json_data)  # Proper JSON serialization
    
    # Process JSON
    result = await processor.process_json_stream(json_str, "test_data.json")
    
    logger.info(f"JSON processing result:")
    logger.info(f"  - Original rows: {result['metadata']['original_rows']}")
    logger.info(f"  - Sampled rows: {result['metadata']['sampled_rows']}")
    logger.info(f"  - File type: {result['metadata'].get('file_type', 'json')}")
    
    logger.info("JSON Processing test completed ✓")


async def main():
    """Run all tests"""
    logger.info("Starting Streaming Processor and Memory Management Tests")
    logger.info("=" * 60)
    
    try:
        await test_memory_monitor()
        logger.info("-" * 40)
        
        await test_streaming_processor()
        logger.info("-" * 40)
        
        await test_json_processing()
        logger.info("-" * 40)
        
        await test_memory_manager()
        logger.info("-" * 40)
        
        logger.info("All tests completed successfully! ✅")
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)