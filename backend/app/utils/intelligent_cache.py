"""
Intelligent Caching System for Performance Optimization

This module implements a multi-layer caching system with:
- Data fingerprinting based on column types, statistics, and patterns
- Multi-layer cache for data profiles, AI responses, and analysis results
- Cache hit rate monitoring and TTL management
"""

import hashlib
import json
import logging
import time
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict
import pandas as pd
from cachetools import TTLCache, LRUCache
import threading

from app.models.analysis import ComprehensiveDataAnalysis, AnalysisResponse, ChartRecommendation

logger = logging.getLogger(__name__)


@dataclass
class CacheMetrics:
    """Cache performance metrics"""
    hits: int = 0
    misses: int = 0
    total_requests: int = 0
    hit_rate: float = 0.0
    last_reset: datetime = field(default_factory=datetime.now)
    
    def record_hit(self):
        """Record a cache hit"""
        self.hits += 1
        self.total_requests += 1
        self._update_hit_rate()
    
    def record_miss(self):
        """Record a cache miss"""
        self.misses += 1
        self.total_requests += 1
        self._update_hit_rate()
    
    def _update_hit_rate(self):
        """Update hit rate calculation"""
        if self.total_requests > 0:
            self.hit_rate = self.hits / self.total_requests
    
    def reset(self):
        """Reset metrics"""
        self.hits = 0
        self.misses = 0
        self.total_requests = 0
        self.hit_rate = 0.0
        self.last_reset = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary"""
        return {
            "hits": self.hits,
            "misses": self.misses,
            "total_requests": self.total_requests,
            "hit_rate": round(self.hit_rate, 4),
            "last_reset": self.last_reset.isoformat()
        }


@dataclass
class DataFingerprint:
    """Data fingerprint for cache key generation"""
    column_types: Dict[str, str]
    column_count: int
    row_count: int
    statistical_hash: str
    pattern_hash: str
    fingerprint: str = ""
    
    def __post_init__(self):
        """Generate fingerprint after initialization"""
        if not self.fingerprint:
            self.fingerprint = self._generate_fingerprint()
    
    def _generate_fingerprint(self) -> str:
        """Generate unique fingerprint for the dataset"""
        fingerprint_data = {
            "column_types": sorted(self.column_types.items()),
            "column_count": self.column_count,
            "row_count": self.row_count,
            "statistical_hash": self.statistical_hash,
            "pattern_hash": self.pattern_hash
        }
        
        fingerprint_str = json.dumps(fingerprint_data, sort_keys=True)
        return hashlib.sha256(fingerprint_str.encode()).hexdigest()[:16]


class DataFingerprintGenerator:
    """Generates fingerprints for datasets based on structure and statistics"""
    
    @staticmethod
    def generate_fingerprint(data: List[Dict[str, Any]]) -> DataFingerprint:
        """
        Generate a fingerprint for the dataset based on:
        - Column types and structure
        - Statistical properties
        - Data patterns
        """
        if not data:
            return DataFingerprint({}, 0, 0, "", "")
        
        # Convert to DataFrame for analysis
        df = pd.DataFrame(data)
        
        # Extract column types
        column_types = {}
        for col in df.columns:
            dtype = str(df[col].dtype)
            if df[col].dtype == 'object':
                # Check if it's actually numeric
                try:
                    pd.to_numeric(df[col], errors='raise')
                    column_types[col] = 'numeric'
                except:
                    # Check if it's datetime
                    try:
                        pd.to_datetime(df[col], errors='raise')
                        column_types[col] = 'datetime'
                    except:
                        column_types[col] = 'categorical'
            elif 'int' in dtype or 'float' in dtype:
                column_types[col] = 'numeric'
            elif 'datetime' in dtype:
                column_types[col] = 'datetime'
            else:
                column_types[col] = 'categorical'
        
        # Generate statistical hash
        statistical_features = []
        for col in df.columns:
            if column_types[col] == 'numeric':
                try:
                    stats = df[col].describe()
                    statistical_features.extend([
                        f"{col}_mean_{stats['mean']:.2f}",
                        f"{col}_std_{stats['std']:.2f}",
                        f"{col}_min_{stats['min']:.2f}",
                        f"{col}_max_{stats['max']:.2f}"
                    ])
                except:
                    pass
            elif column_types[col] == 'categorical':
                unique_count = df[col].nunique()
                statistical_features.append(f"{col}_unique_{unique_count}")
        
        statistical_hash = hashlib.md5(
            json.dumps(sorted(statistical_features)).encode()
        ).hexdigest()[:8]
        
        # Generate pattern hash (based on data distribution patterns)
        pattern_features = []
        for col in df.columns:
            null_pct = df[col].isnull().sum() / len(df) * 100
            unique_pct = df[col].nunique() / len(df) * 100
            pattern_features.extend([
                f"{col}_null_{null_pct:.1f}",
                f"{col}_unique_{unique_pct:.1f}"
            ])
        
        pattern_hash = hashlib.md5(
            json.dumps(sorted(pattern_features)).encode()
        ).hexdigest()[:8]
        
        return DataFingerprint(
            column_types=column_types,
            column_count=len(df.columns),
            row_count=len(df),
            statistical_hash=statistical_hash,
            pattern_hash=pattern_hash
        )


class IntelligentCache:
    """
    Multi-layer intelligent caching system with fingerprinting and monitoring
    """
    
    def __init__(self):
        # Cache layers with different TTL values
        self.data_fingerprint_cache = TTLCache(maxsize=500, ttl=3600)  # 1 hour
        self.ai_response_cache = TTLCache(maxsize=200, ttl=1800)       # 30 minutes
        self.analysis_cache = TTLCache(maxsize=100, ttl=900)           # 15 minutes
        self.chart_config_cache = TTLCache(maxsize=300, ttl=2700)      # 45 minutes
        
        # Cache metrics for monitoring
        self.metrics = {
            'fingerprint': CacheMetrics(),
            'ai_response': CacheMetrics(),
            'analysis': CacheMetrics(),
            'chart_config': CacheMetrics()
        }
        
        # Thread lock for thread safety
        self._lock = threading.RLock()
        
        # Fingerprint generator
        self.fingerprint_generator = DataFingerprintGenerator()
        
        logger.info("Intelligent cache system initialized")
    
    def get_data_fingerprint(self, data: List[Dict[str, Any]]) -> str:
        """
        Get or generate data fingerprint for caching
        
        Args:
            data: Dataset to fingerprint
            
        Returns:
            Fingerprint string for cache key generation
        """
        with self._lock:
            # Create a quick hash of the data for lookup
            data_hash = hashlib.md5(
                json.dumps(data[:100], sort_keys=True).encode()  # Use first 100 rows for speed
            ).hexdigest()[:12]
            
            # Check if fingerprint is cached
            if data_hash in self.data_fingerprint_cache:
                self.metrics['fingerprint'].record_hit()
                return self.data_fingerprint_cache[data_hash].fingerprint
            
            # Generate new fingerprint
            self.metrics['fingerprint'].record_miss()
            fingerprint_obj = self.fingerprint_generator.generate_fingerprint(data)
            
            # Cache the fingerprint object
            self.data_fingerprint_cache[data_hash] = fingerprint_obj
            
            logger.debug(f"Generated fingerprint: {fingerprint_obj.fingerprint}")
            return fingerprint_obj.fingerprint
    
    def get_cached_analysis(self, fingerprint: str) -> Optional[ComprehensiveDataAnalysis]:
        """
        Retrieve cached analysis result for similar data
        
        Args:
            fingerprint: Data fingerprint
            
        Returns:
            Cached analysis or None if not found
        """
        with self._lock:
            cache_key = f"analysis_{fingerprint}"
            
            if cache_key in self.analysis_cache:
                self.metrics['analysis'].record_hit()
                logger.debug(f"Cache hit for analysis: {fingerprint}")
                return self.analysis_cache[cache_key]
            
            self.metrics['analysis'].record_miss()
            logger.debug(f"Cache miss for analysis: {fingerprint}")
            return None
    
    def cache_analysis_result(self, fingerprint: str, analysis: ComprehensiveDataAnalysis) -> None:
        """
        Cache analysis result with fingerprint key
        
        Args:
            fingerprint: Data fingerprint
            analysis: Analysis result to cache
        """
        with self._lock:
            cache_key = f"analysis_{fingerprint}"
            self.analysis_cache[cache_key] = analysis
            logger.debug(f"Cached analysis result: {fingerprint}")
    
    def get_cached_ai_response(self, prompt_hash: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached AI response for similar prompts
        
        Args:
            prompt_hash: Hash of the AI prompt
            
        Returns:
            Cached AI response or None if not found
        """
        with self._lock:
            cache_key = f"ai_{prompt_hash}"
            
            if cache_key in self.ai_response_cache:
                self.metrics['ai_response'].record_hit()
                logger.debug(f"Cache hit for AI response: {prompt_hash}")
                return self.ai_response_cache[cache_key]
            
            self.metrics['ai_response'].record_miss()
            logger.debug(f"Cache miss for AI response: {prompt_hash}")
            return None
    
    def cache_ai_response(self, prompt_hash: str, response: Dict[str, Any]) -> None:
        """
        Cache AI response with prompt hash key
        
        Args:
            prompt_hash: Hash of the AI prompt
            response: AI response to cache
        """
        with self._lock:
            cache_key = f"ai_{prompt_hash}"
            self.ai_response_cache[cache_key] = response
            logger.debug(f"Cached AI response: {prompt_hash}")
    
    def get_cached_chart_recommendations(self, fingerprint: str) -> Optional[List[ChartRecommendation]]:
        """
        Retrieve cached chart recommendations for similar data patterns
        
        Args:
            fingerprint: Data fingerprint
            
        Returns:
            Cached chart recommendations or None if not found
        """
        with self._lock:
            cache_key = f"charts_{fingerprint}"
            
            if cache_key in self.chart_config_cache:
                self.metrics['chart_config'].record_hit()
                logger.debug(f"Cache hit for chart recommendations: {fingerprint}")
                return self.chart_config_cache[cache_key]
            
            self.metrics['chart_config'].record_miss()
            logger.debug(f"Cache miss for chart recommendations: {fingerprint}")
            return None
    
    def cache_chart_recommendations(self, fingerprint: str, recommendations: List[ChartRecommendation]) -> None:
        """
        Cache chart recommendations with fingerprint key
        
        Args:
            fingerprint: Data fingerprint
            recommendations: Chart recommendations to cache
        """
        with self._lock:
            cache_key = f"charts_{fingerprint}"
            self.chart_config_cache[cache_key] = recommendations
            logger.debug(f"Cached chart recommendations: {fingerprint}")
    
    def generate_prompt_hash(self, prompt: str, context: Dict[str, Any] = None) -> str:
        """
        Generate hash for AI prompt caching
        
        Args:
            prompt: AI prompt text
            context: Additional context for the prompt
            
        Returns:
            Hash string for cache key generation
        """
        prompt_data = {
            "prompt": prompt,
            "context": context or {}
        }
        
        prompt_str = json.dumps(prompt_data, sort_keys=True)
        return hashlib.sha256(prompt_str.encode()).hexdigest()[:16]
    
    def get_cache_metrics(self) -> Dict[str, Any]:
        """
        Get comprehensive cache performance metrics
        
        Returns:
            Dictionary containing metrics for all cache layers
        """
        with self._lock:
            return {
                cache_type: metrics.to_dict() 
                for cache_type, metrics in self.metrics.items()
            }
    
    def get_cache_sizes(self) -> Dict[str, int]:
        """
        Get current cache sizes
        
        Returns:
            Dictionary with current size of each cache
        """
        with self._lock:
            return {
                'fingerprint': len(self.data_fingerprint_cache),
                'ai_response': len(self.ai_response_cache),
                'analysis': len(self.analysis_cache),
                'chart_config': len(self.chart_config_cache)
            }
    
    def clear_cache(self, cache_type: Optional[str] = None) -> None:
        """
        Clear cache(s)
        
        Args:
            cache_type: Specific cache to clear, or None to clear all
        """
        with self._lock:
            if cache_type is None:
                # Clear all caches
                self.data_fingerprint_cache.clear()
                self.ai_response_cache.clear()
                self.analysis_cache.clear()
                self.chart_config_cache.clear()
                
                # Reset metrics
                for metrics in self.metrics.values():
                    metrics.reset()
                
                logger.info("Cleared all caches")
            else:
                # Clear specific cache
                if cache_type == 'fingerprint':
                    self.data_fingerprint_cache.clear()
                elif cache_type == 'ai_response':
                    self.ai_response_cache.clear()
                elif cache_type == 'analysis':
                    self.analysis_cache.clear()
                elif cache_type == 'chart_config':
                    self.chart_config_cache.clear()
                
                # Reset specific metrics
                if cache_type in self.metrics:
                    self.metrics[cache_type].reset()
                
                logger.info(f"Cleared {cache_type} cache")
    
    def optimize_cache_performance(self) -> Dict[str, Any]:
        """
        Analyze and optimize cache performance
        
        Returns:
            Optimization recommendations and actions taken
        """
        with self._lock:
            recommendations = []
            actions_taken = []
            
            # Check hit rates and recommend optimizations
            for cache_type, metrics in self.metrics.items():
                if metrics.total_requests > 10:  # Only analyze if we have enough data
                    if metrics.hit_rate < 0.3:  # Less than 30% hit rate
                        recommendations.append(
                            f"{cache_type} cache has low hit rate ({metrics.hit_rate:.2%}). "
                            f"Consider increasing TTL or cache size."
                        )
                    elif metrics.hit_rate > 0.8:  # Greater than 80% hit rate
                        recommendations.append(
                            f"{cache_type} cache has excellent hit rate ({metrics.hit_rate:.2%}). "
                            f"Current configuration is optimal."
                        )
            
            # Check cache utilization
            cache_sizes = self.get_cache_sizes()
            for cache_type, size in cache_sizes.items():
                max_size = getattr(getattr(self, f"{cache_type}_cache"), 'maxsize', 0)
                if max_size > 0:
                    utilization = size / max_size
                    if utilization > 0.9:  # Over 90% utilization
                        recommendations.append(
                            f"{cache_type} cache is {utilization:.1%} full. "
                            f"Consider increasing cache size."
                        )
            
            return {
                "recommendations": recommendations,
                "actions_taken": actions_taken,
                "current_metrics": self.get_cache_metrics(),
                "cache_sizes": cache_sizes
            }


# Global cache instance
_cache_instance = None
_cache_lock = threading.Lock()


def get_intelligent_cache() -> IntelligentCache:
    """
    Get the global intelligent cache instance (singleton pattern)
    
    Returns:
        Global IntelligentCache instance
    """
    global _cache_instance
    
    if _cache_instance is None:
        with _cache_lock:
            if _cache_instance is None:
                _cache_instance = IntelligentCache()
    
    return _cache_instance


def clear_global_cache() -> None:
    """Clear the global cache instance"""
    global _cache_instance  # noqa: F824

    if _cache_instance is not None:
        _cache_instance.clear_cache()