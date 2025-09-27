"""
Streaming Data Processor for Performance Optimization
Handles large files in chunks instead of loading entirely into memory
"""

import asyncio
import gc
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, AsyncGenerator, Union
from io import StringIO, BytesIO
import json
import csv
from pathlib import Path
import psutil
import os

from app.utils.data_sampling import DataSampler

logger = logging.getLogger(__name__)


class MemoryMonitor:
    """Monitor system memory usage and provide memory management utilities"""
    
    def __init__(self, memory_limit_mb: int = 512):
        """
        Initialize memory monitor
        
        Args:
            memory_limit_mb: Maximum memory limit in MB for processing
        """
        self.memory_limit_bytes = memory_limit_mb * 1024 * 1024
        self.process = psutil.Process(os.getpid())
    
    def get_memory_usage(self) -> Dict[str, int]:
        """Get current memory usage statistics"""
        memory_info = self.process.memory_info()
        return {
            "rss": memory_info.rss,  # Resident Set Size
            "vms": memory_info.vms,  # Virtual Memory Size
            "percent": self.process.memory_percent(),
            "available": psutil.virtual_memory().available
        }
    
    def is_memory_available(self, required_bytes: int) -> bool:
        """Check if required memory is available"""
        current_usage = self.get_memory_usage()
        return (current_usage["rss"] + required_bytes) < self.memory_limit_bytes
    
    def get_memory_pressure(self) -> float:
        """Get memory pressure as percentage (0.0 to 1.0)"""
        current_usage = self.get_memory_usage()
        return current_usage["rss"] / self.memory_limit_bytes
    
    def force_garbage_collection(self) -> int:
        """Force garbage collection and return number of objects collected"""
        collected = gc.collect()
        logger.info(f"Garbage collection freed {collected} objects")
        return collected


class StreamingDataProcessor:
    """Process large files in chunks to optimize memory usage"""
    
    def __init__(self, 
                 chunk_size: int = 10000, 
                 memory_limit_mb: int = 512,
                 sample_size: int = 5000):
        """
        Initialize streaming data processor
        
        Args:
            chunk_size: Number of rows to process in each chunk
            memory_limit_mb: Memory limit for processing
            sample_size: Maximum sample size for analysis
        """
        self.chunk_size = chunk_size
        self.memory_monitor = MemoryMonitor(memory_limit_mb)
        self.data_sampler = DataSampler(max_sample_size=sample_size)
        self.processing_stats = {
            "total_rows_processed": 0,
            "chunks_processed": 0,
            "memory_peak": 0,
            "gc_collections": 0
        }
    
    async def process_csv_stream(self, 
                                file_content: Union[str, bytes], 
                                filename: str = "data.csv") -> Dict[str, Any]:
        """
        Process CSV file in streaming chunks
        
        Args:
            file_content: CSV file content as string or bytes
            filename: Name of the file for logging
            
        Returns:
            Dictionary with sampled data and metadata
        """
        logger.info(f"Starting streaming CSV processing for {filename}")
        
        # Convert bytes to string if needed
        if isinstance(file_content, bytes):
            file_content = file_content.decode('utf-8')
        
        # Create StringIO for pandas to read
        csv_buffer = StringIO(file_content)
        
        # Get file size estimate
        file_size_bytes = len(file_content.encode('utf-8'))
        logger.info(f"File size: {file_size_bytes / (1024*1024):.2f} MB")
        
        # Determine optimal chunk size based on file size and memory
        optimal_chunk_size = self._calculate_optimal_chunk_size(file_size_bytes)
        
        all_data = []
        chunk_count = 0
        
        try:
            # Read CSV in chunks
            chunk_iterator = pd.read_csv(
                csv_buffer, 
                chunksize=optimal_chunk_size,
                low_memory=True,
                dtype=str  # Read as strings initially to avoid type inference overhead
            )
            
            for chunk in chunk_iterator:
                # Check memory pressure before processing chunk
                if self.memory_monitor.get_memory_pressure() > 0.8:
                    logger.warning("Memory pressure > 80%, forcing garbage collection")
                    self.memory_monitor.force_garbage_collection()
                    self.processing_stats["gc_collections"] += 1
                
                # Process chunk
                processed_chunk = await self._process_chunk(chunk, chunk_count)
                all_data.extend(processed_chunk)
                
                chunk_count += 1
                self.processing_stats["chunks_processed"] = chunk_count
                self.processing_stats["total_rows_processed"] += len(processed_chunk)
                
                # Update memory peak
                current_memory = self.memory_monitor.get_memory_usage()["rss"]
                self.processing_stats["memory_peak"] = max(
                    self.processing_stats["memory_peak"], 
                    current_memory
                )
                
                # Log progress every 10 chunks
                if chunk_count % 10 == 0:
                    logger.info(f"Processed {chunk_count} chunks, {len(all_data)} total rows")
                
                # Yield control to event loop
                await asyncio.sleep(0)
            
            # Create statistical sample from all data
            sampled_data = self.data_sampler.smart_sample(all_data)
            
            # Generate metadata
            metadata = self._generate_processing_metadata(
                original_size=len(all_data),
                sampled_size=len(sampled_data),
                file_size_bytes=file_size_bytes,
                filename=filename
            )
            
            # Final garbage collection
            self.memory_monitor.force_garbage_collection()
            
            logger.info(f"Streaming processing complete: {len(all_data)} -> {len(sampled_data)} rows")
            
            return {
                "data": sampled_data,
                "metadata": metadata,
                "processing_stats": self.processing_stats
            }
            
        except Exception as e:
            logger.error(f"Streaming CSV processing failed: {e}")
            raise
    
    async def process_json_stream(self, 
                                 file_content: Union[str, bytes], 
                                 filename: str = "data.json") -> Dict[str, Any]:
        """
        Process JSON file with memory optimization
        
        Args:
            file_content: JSON file content
            filename: Name of the file for logging
            
        Returns:
            Dictionary with sampled data and metadata
        """
        logger.info(f"Starting streaming JSON processing for {filename}")
        
        # Convert bytes to string if needed
        if isinstance(file_content, bytes):
            file_content = file_content.decode('utf-8')
        
        file_size_bytes = len(file_content.encode('utf-8'))
        
        try:
            # Parse JSON
            json_data = json.loads(file_content)
            
            # Handle different JSON structures
            if isinstance(json_data, list):
                data = json_data
            elif isinstance(json_data, dict):
                if 'data' in json_data and isinstance(json_data['data'], list):
                    data = json_data['data']
                else:
                    data = [json_data]
            else:
                raise ValueError("JSON must contain an array or object with data array")
            
            # Filter valid objects
            valid_data = [item for item in data if isinstance(item, dict)]
            
            if not valid_data:
                raise ValueError("No valid data objects found in JSON")
            
            # Create sample
            sampled_data = self.data_sampler.smart_sample(valid_data)
            
            # Generate metadata
            metadata = self._generate_processing_metadata(
                original_size=len(valid_data),
                sampled_size=len(sampled_data),
                file_size_bytes=file_size_bytes,
                filename=filename
            )
            
            # Cleanup
            del json_data, data, valid_data
            self.memory_monitor.force_garbage_collection()
            
            logger.info(f"JSON processing complete: {len(sampled_data)} rows")
            
            return {
                "data": sampled_data,
                "metadata": metadata,
                "processing_stats": self.processing_stats
            }
            
        except Exception as e:
            logger.error(f"JSON processing failed: {e}")
            raise
    
    async def _process_chunk(self, chunk: pd.DataFrame, chunk_index: int) -> List[Dict[str, Any]]:
        """Process a single chunk of data"""
        try:
            # Convert DataFrame to list of dictionaries
            chunk_data = chunk.to_dict('records')
            
            # Clean up the chunk DataFrame to free memory
            del chunk
            
            return chunk_data
            
        except Exception as e:
            logger.error(f"Failed to process chunk {chunk_index}: {e}")
            return []
    
    def _calculate_optimal_chunk_size(self, file_size_bytes: int) -> int:
        """Calculate optimal chunk size based on file size and available memory"""
        # Get available memory
        available_memory = self.memory_monitor.get_memory_usage()["available"]
        
        # Use 10% of available memory for chunk processing
        target_chunk_memory = available_memory * 0.1
        
        # Estimate bytes per row (rough estimate)
        estimated_bytes_per_row = 1024  # 1KB per row estimate
        
        # Calculate chunk size
        calculated_chunk_size = int(target_chunk_memory / estimated_bytes_per_row)
        
        # Ensure chunk size is within reasonable bounds
        min_chunk_size = 1000
        max_chunk_size = 50000
        
        optimal_chunk_size = max(min_chunk_size, min(calculated_chunk_size, max_chunk_size))
        
        logger.info(f"Calculated optimal chunk size: {optimal_chunk_size} rows")
        return optimal_chunk_size
    
    def _generate_processing_metadata(self, 
                                    original_size: int, 
                                    sampled_size: int,
                                    file_size_bytes: int,
                                    filename: str) -> Dict[str, Any]:
        """Generate metadata about the processing operation"""
        return {
            "original_rows": original_size,
            "sampled_rows": sampled_size,
            "sampling_ratio": sampled_size / original_size if original_size > 0 else 0,
            "file_size_bytes": file_size_bytes,
            "file_size_mb": file_size_bytes / (1024 * 1024),
            "filename": filename,
            "is_sampled": sampled_size < original_size,
            "chunk_size_used": self.chunk_size,
            "memory_limit_mb": self.memory_monitor.memory_limit_bytes / (1024 * 1024),
            "processing_method": "streaming"
        }
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get current processing statistics"""
        return {
            **self.processing_stats,
            "memory_usage": self.memory_monitor.get_memory_usage(),
            "memory_pressure": self.memory_monitor.get_memory_pressure()
        }