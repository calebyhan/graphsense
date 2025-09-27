#!/usr/bin/env python3
"""
Integration test for streaming data processing with the API
"""

import asyncio
import logging
import sys
import os
from pathlib import Path
import tempfile
import csv

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.utils.enhanced_file_parser import EnhancedFileParser
from app.utils.memory_manager import initialize_memory_manager, shutdown_memory_manager, RequestPriority
from fastapi import UploadFile
from io import BytesIO

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MockUploadFile:
    """Mock UploadFile for testing"""
    
    def __init__(self, content: bytes, filename: str):
        self.content = content
        self.filename = filename
        self._position = 0
    
    async def read(self) -> bytes:
        return self.content
    
    async def seek(self, position: int):
        self._position = position


async def test_enhanced_file_parser():
    """Test the enhanced file parser with different file types"""
    logger.info("Testing Enhanced File Parser...")
    
    # Initialize memory manager
    await initialize_memory_manager()
    
    try:
        parser = EnhancedFileParser(
            chunk_size=1000,
            memory_limit_mb=256,
            sample_size=100
        )
        
        # Test CSV parsing
        logger.info("Testing CSV parsing...")
        csv_content = "name,age,city,salary\n"
        for i in range(2000):
            csv_content += f"Person_{i},{20 + (i % 50)},City_{i % 10},{30000 + (i * 100)}\n"
        
        csv_file = MockUploadFile(csv_content.encode('utf-8'), "test.csv")
        
        result = await parser.parse_file(
            file=csv_file,
            request_id="test_csv_001",
            priority=RequestPriority.HIGH
        )
        
        logger.info(f"CSV parsing result:")
        logger.info(f"  - Data rows: {len(result['data'])}")
        logger.info(f"  - Original rows: {result['metadata']['original_rows']}")
        logger.info(f"  - Sampled rows: {result['metadata']['sampled_rows']}")
        logger.info(f"  - File size: {result['metadata']['file_size_mb']:.2f} MB")
        logger.info(f"  - Parsing method: {result['metadata']['parsing_method']}")
        
        # Test JSON parsing
        logger.info("Testing JSON parsing...")
        import json
        json_data = {
            "data": [
                {"id": i, "name": f"Item_{i}", "value": i * 10, "category": f"Cat_{i % 5}"}
                for i in range(1500)
            ]
        }
        json_content = json.dumps(json_data)
        json_file = MockUploadFile(json_content.encode('utf-8'), "test.json")
        
        result = await parser.parse_file(
            file=json_file,
            request_id="test_json_001",
            priority=RequestPriority.NORMAL
        )
        
        logger.info(f"JSON parsing result:")
        logger.info(f"  - Data rows: {len(result['data'])}")
        logger.info(f"  - Original rows: {result['metadata']['original_rows']}")
        logger.info(f"  - Sampled rows: {result['metadata']['sampled_rows']}")
        logger.info(f"  - File size: {result['metadata']['file_size_mb']:.2f} MB")
        
        # Test file preview
        logger.info("Testing file preview...")
        preview = await parser.get_file_preview(
            csv_content.encode('utf-8'),
            "test.csv",
            preview_rows=3
        )
        
        logger.info(f"Preview result:")
        logger.info(f"  - Preview rows: {len(preview['preview_data'])}")
        logger.info(f"  - Total lines estimate: {preview['total_lines_estimate']}")
        logger.info(f"  - Columns: {preview['columns']}")
        
        logger.info("Enhanced File Parser test completed ✓")
        
    finally:
        await shutdown_memory_manager()


async def test_memory_pressure_handling():
    """Test how the system handles memory pressure"""
    logger.info("Testing Memory Pressure Handling...")
    
    # Initialize with very low memory limit to trigger queuing
    from app.utils.memory_manager import MemoryManager
    
    manager = MemoryManager(
        max_memory_mb=50,  # Very low limit
        memory_threshold=0.1,  # Very low threshold
        max_queue_size=5
    )
    
    await manager.start()
    
    try:
        # Create multiple large requests that should be queued
        results = []
        
        async def large_task(task_id: int):
            logger.info(f"Executing large task {task_id}")
            await asyncio.sleep(0.5)  # Simulate processing time
            return f"Task {task_id} completed"
        
        # Submit multiple requests
        for i in range(5):
            success = await manager.queue_request(
                request_id=f"large_task_{i}",
                callback=lambda i=i: large_task(i),
                estimated_memory_mb=100,  # Large memory requirement
                priority=RequestPriority.NORMAL
            )
            logger.info(f"Large task {i} queued: {success}")
        
        # Wait for processing
        await asyncio.sleep(3)
        
        # Check final status
        status = manager.get_queue_status()
        logger.info(f"Final status: {status['stats']}")
        
        logger.info("Memory Pressure Handling test completed ✓")
        
    finally:
        await manager.stop()


async def test_large_file_simulation():
    """Simulate processing a large file"""
    logger.info("Testing Large File Simulation...")
    
    await initialize_memory_manager()
    
    try:
        parser = EnhancedFileParser(
            chunk_size=5000,
            memory_limit_mb=512,
            sample_size=1000
        )
        
        # Create a large CSV file (simulate 100MB file)
        logger.info("Creating large CSV simulation...")
        large_csv = "id,name,email,age,city,country,salary,department,join_date\n"
        
        # Generate 50,000 rows to simulate a large file
        for i in range(50000):
            large_csv += f"{i},Person_{i},person{i}@email.com,{20 + (i % 50)},City_{i % 100},Country_{i % 20},{30000 + (i * 10)},Dept_{i % 10},2020-{1 + (i % 12):02d}-{1 + (i % 28):02d}\n"
        
        file_size_mb = len(large_csv.encode('utf-8')) / (1024 * 1024)
        logger.info(f"Generated CSV file: {file_size_mb:.2f} MB, ~50,000 rows")
        
        # Parse the large file
        large_file = MockUploadFile(large_csv.encode('utf-8'), "large_test.csv")
        
        start_time = asyncio.get_event_loop().time()
        result = await parser.parse_file(
            file=large_file,
            request_id="large_file_test",
            priority=RequestPriority.HIGH
        )
        end_time = asyncio.get_event_loop().time()
        
        processing_time = end_time - start_time
        
        logger.info(f"Large file processing completed in {processing_time:.2f} seconds")
        logger.info(f"Results:")
        logger.info(f"  - Original rows: {result['metadata']['original_rows']}")
        logger.info(f"  - Sampled rows: {result['metadata']['sampled_rows']}")
        logger.info(f"  - Sampling ratio: {result['metadata']['sampling_ratio']:.3f}")
        logger.info(f"  - File size: {result['metadata']['file_size_mb']:.2f} MB")
        logger.info(f"  - Processing method: {result['metadata']['parsing_method']}")
        
        # Verify data quality
        if result['data']:
            sample_row = result['data'][0]
            logger.info(f"Sample row columns: {list(sample_row.keys())}")
            logger.info(f"Data types preserved: {all(isinstance(v, str) for v in sample_row.values())}")
        
        logger.info("Large File Simulation test completed ✓")
        
    finally:
        await shutdown_memory_manager()


async def main():
    """Run all integration tests"""
    logger.info("Starting Integration Tests for Streaming Data Processing")
    logger.info("=" * 70)
    
    try:
        await test_enhanced_file_parser()
        logger.info("-" * 50)
        
        await test_memory_pressure_handling()
        logger.info("-" * 50)
        
        await test_large_file_simulation()
        logger.info("-" * 50)
        
        logger.info("All integration tests completed successfully! ✅")
        
    except Exception as e:
        logger.error(f"Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)