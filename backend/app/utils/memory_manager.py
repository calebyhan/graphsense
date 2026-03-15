"""
Memory Management System for Request Queuing and Resource Control
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional, Callable, Awaitable
from dataclasses import dataclass
from enum import Enum
import psutil
import os
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RequestPriority(Enum):
    """Request priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3


@dataclass
class QueuedRequest:
    """Represents a queued processing request"""
    request_id: str
    priority: RequestPriority
    estimated_memory_mb: int
    created_at: datetime
    timeout_seconds: int
    callback: Callable[[], Awaitable[Any]]
    
    def __post_init__(self):
        self.estimated_memory_bytes = self.estimated_memory_mb * 1024 * 1024


class MemoryManager:
    """
    Manages memory usage and request queuing to prevent memory exhaustion
    """
    
    def __init__(self, 
                 max_memory_mb: int = 512,
                 memory_threshold: float = 0.8,
                 max_queue_size: int = 100,
                 cleanup_interval: int = 60):
        """
        Initialize memory manager
        
        Args:
            max_memory_mb: Maximum memory limit in MB
            memory_threshold: Memory usage threshold (0.0-1.0) to start queuing
            max_queue_size: Maximum number of queued requests
            cleanup_interval: Interval in seconds for cleanup tasks
        """
        self.max_memory_bytes = max_memory_mb * 1024 * 1024
        self.memory_threshold = memory_threshold
        self.max_queue_size = max_queue_size
        self.cleanup_interval = cleanup_interval
        
        # Request queue (priority queue)
        self.request_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.active_requests: Dict[str, QueuedRequest] = {}
        self.processing_requests: Dict[str, QueuedRequest] = {}
        
        # Statistics
        self.stats = {
            "total_requests": 0,
            "queued_requests": 0,
            "processed_requests": 0,
            "rejected_requests": 0,
            "memory_pressure_events": 0,
            "queue_full_events": 0
        }
        
        # Background tasks
        self._cleanup_task: Optional[asyncio.Task] = None
        self._processor_task: Optional[asyncio.Task] = None
        self._running = False
        
        # Process monitoring
        self.process = psutil.Process(os.getpid())
    
    async def start(self):
        """Start the memory manager background tasks"""
        if self._running:
            return
        
        self._running = True
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        self._processor_task = asyncio.create_task(self._process_queue())
        
        logger.info("Memory manager started")
    
    async def stop(self):
        """Stop the memory manager and cleanup"""
        self._running = False
        
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._processor_task:
            self._processor_task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(
            self._cleanup_task, 
            self._processor_task, 
            return_exceptions=True
        )
        
        logger.info("Memory manager stopped")
    
    def get_memory_usage(self) -> Dict[str, Any]:
        """Get current memory usage statistics"""
        try:
            memory_info = self.process.memory_info()
            virtual_memory = psutil.virtual_memory()
            
            return {
                "process_rss_mb": memory_info.rss / (1024 * 1024),
                "process_vms_mb": memory_info.vms / (1024 * 1024),
                "process_percent": self.process.memory_percent(),
                "system_total_mb": virtual_memory.total / (1024 * 1024),
                "system_available_mb": virtual_memory.available / (1024 * 1024),
                "system_used_percent": virtual_memory.percent,
                "memory_pressure": self.get_memory_pressure()
            }
        except Exception as e:
            logger.error(f"Failed to get memory usage: {e}")
            return {"error": str(e)}
    
    def get_memory_pressure(self) -> float:
        """Get current memory pressure (0.0 to 1.0)"""
        try:
            memory_info = self.process.memory_info()
            return memory_info.rss / self.max_memory_bytes
        except Exception:
            return 0.0
    
    def is_memory_available(self, required_mb: int) -> bool:
        """Check if required memory is available"""
        try:
            current_pressure = self.get_memory_pressure()
            required_bytes = required_mb * 1024 * 1024
            projected_pressure = (self.process.memory_info().rss + required_bytes) / self.max_memory_bytes
            
            return projected_pressure < self.memory_threshold
        except Exception:
            return False
    
    async def queue_request(self, 
                           request_id: str,
                           callback: Callable[[], Awaitable[Any]],
                           estimated_memory_mb: int = 50,
                           priority: RequestPriority = RequestPriority.NORMAL,
                           timeout_seconds: int = 300) -> bool:
        """
        Queue a processing request
        
        Args:
            request_id: Unique identifier for the request
            callback: Async function to execute when resources are available
            estimated_memory_mb: Estimated memory usage in MB
            priority: Request priority
            timeout_seconds: Request timeout in seconds
            
        Returns:
            True if request was queued, False if rejected
        """
        self.stats["total_requests"] += 1
        
        # Check if queue is full
        if self.request_queue.qsize() >= self.max_queue_size:
            self.stats["queue_full_events"] += 1
            self.stats["rejected_requests"] += 1
            logger.warning(f"Request {request_id} rejected: queue full")
            return False
        
        # Check if memory is immediately available
        if self.is_memory_available(estimated_memory_mb):
            # Execute immediately
            try:
                await self._execute_request(request_id, callback)
                return True
            except Exception as e:
                logger.error(f"Immediate execution failed for {request_id}: {e}")
                return False
        
        # Queue the request
        queued_request = QueuedRequest(
            request_id=request_id,
            priority=priority,
            estimated_memory_mb=estimated_memory_mb,
            created_at=datetime.now(),
            timeout_seconds=timeout_seconds,
            callback=callback
        )
        
        # Priority queue uses negative priority for max-heap behavior
        priority_value = -priority.value
        await self.request_queue.put((priority_value, time.time(), queued_request))
        
        self.active_requests[request_id] = queued_request
        self.stats["queued_requests"] += 1
        self.stats["memory_pressure_events"] += 1
        
        logger.info(f"Request {request_id} queued (priority: {priority.name}, memory: {estimated_memory_mb}MB)")
        return True
    
    async def _process_queue(self):
        """Background task to process queued requests"""
        while self._running:
            try:
                # Wait for a request with timeout
                try:
                    priority_value, timestamp, request = await asyncio.wait_for(
                        self.request_queue.get(), 
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Check if request has timed out
                if datetime.now() - request.created_at > timedelta(seconds=request.timeout_seconds):
                    logger.warning(f"Request {request.request_id} timed out")
                    self.active_requests.pop(request.request_id, None)
                    continue

                # Check if request is no longer active (e.g. cancelled)
                if request.request_id not in self.active_requests:
                    logger.debug(f"Request {request.request_id} is no longer active, skipping")
                    continue
                
                # Check if memory is available
                if not self.is_memory_available(request.estimated_memory_mb):
                    # Put request back in queue
                    await self.request_queue.put((priority_value, timestamp, request))
                    await asyncio.sleep(1)  # Wait before retrying
                    continue
                
                # Execute the request
                try:
                    await self._execute_request(request.request_id, request.callback)
                    self.active_requests.pop(request.request_id, None)
                except Exception as e:
                    logger.error(f"Failed to execute queued request {request.request_id}: {e}")
                    self.active_requests.pop(request.request_id, None)
                
            except Exception as e:
                logger.error(f"Error in queue processor: {e}")
                await asyncio.sleep(1)
    
    async def _execute_request(self, request_id: str, callback: Callable[[], Awaitable[Any]]):
        """Execute a request and track it"""
        logger.info(f"Executing request {request_id}")
        
        start_time = time.time()
        try:
            # Track as processing
            if request_id in self.active_requests:
                self.processing_requests[request_id] = self.active_requests[request_id]
            
            # Execute the callback
            await callback()
            
            # Update stats
            self.stats["processed_requests"] += 1
            execution_time = time.time() - start_time
            logger.info(f"Request {request_id} completed in {execution_time:.2f}s")
            
        finally:
            # Remove from processing
            self.processing_requests.pop(request_id, None)
    
    async def _cleanup_loop(self):
        """Background cleanup task"""
        while self._running:
            try:
                await asyncio.sleep(self.cleanup_interval)
                await self._cleanup_expired_requests()
                await self._force_garbage_collection()
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
    
    async def _cleanup_expired_requests(self):
        """Remove expired requests from the queue"""
        current_time = datetime.now()
        expired_requests = []
        
        for request_id, request in self.active_requests.items():
            if current_time - request.created_at > timedelta(seconds=request.timeout_seconds):
                expired_requests.append(request_id)
        
        for request_id in expired_requests:
            self.active_requests.pop(request_id, None)
            logger.info(f"Cleaned up expired request: {request_id}")
    
    async def _force_garbage_collection(self):
        """Force garbage collection if memory pressure is high"""
        if self.get_memory_pressure() > 0.7:
            import gc
            collected = gc.collect()
            logger.info(f"Forced garbage collection: {collected} objects collected")
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status"""
        return {
            "queue_size": self.request_queue.qsize(),
            "active_requests": len(self.active_requests),
            "processing_requests": len(self.processing_requests),
            "memory_usage": self.get_memory_usage(),
            "stats": self.stats.copy()
        }
    
    def cancel_request(self, request_id: str) -> bool:
        """Cancel a queued request"""
        if request_id in self.active_requests:
            del self.active_requests[request_id]
            logger.info(f"Cancelled request: {request_id}")
            return True
        return False


# Global memory manager instance
_memory_manager: Optional[MemoryManager] = None


def get_memory_manager() -> MemoryManager:
    """Get the global memory manager instance"""
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = MemoryManager()
    return _memory_manager


async def initialize_memory_manager():
    """Initialize and start the global memory manager"""
    manager = get_memory_manager()
    await manager.start()
    return manager


async def shutdown_memory_manager():
    """Shutdown the global memory manager"""
    global _memory_manager
    if _memory_manager:
        await _memory_manager.stop()
        _memory_manager = None