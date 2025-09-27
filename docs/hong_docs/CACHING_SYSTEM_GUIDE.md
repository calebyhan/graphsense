# Intelligent Caching System Guide

## Overview

The intelligent caching system implements a multi-layer caching strategy to optimize performance by reducing redundant computations and API calls. It includes data fingerprinting, AI response caching, and comprehensive monitoring.

## Architecture

### Cache Layers

1. **Data Fingerprint Cache** (1 hour TTL, 500 items)
   - Caches dataset fingerprints based on structure and statistics
   - Enables quick identification of similar datasets

2. **AI Response Cache** (30 minutes TTL, 200 items)
   - Caches Gemini AI responses for similar prompts
   - Reduces API calls and improves response times

3. **Analysis Cache** (15 minutes TTL, 100 items)
   - Caches complete data analysis results
   - Enables instant results for similar datasets

4. **Chart Configuration Cache** (45 minutes TTL, 300 items)
   - Caches chart recommendations for similar data patterns
   - Speeds up visualization suggestions

### Data Fingerprinting

The system generates unique fingerprints based on:
- Column types and structure
- Statistical properties (mean, std, min, max)
- Data patterns (null percentages, unique values)
- Row and column counts

## Usage

### Automatic Caching

The caching system is automatically integrated into the agent pipeline:

```python
# In agent pipeline
fingerprint = self.cache.get_data_fingerprint(data)
cached_analysis = self.cache.get_cached_analysis(fingerprint)

if cached_analysis:
    # Use cached result
    return cached_analysis
else:
    # Generate new analysis and cache it
    analysis = await self.profiler_agent.analyze(data)
    self.cache.cache_analysis_result(fingerprint, analysis)
```

### Manual Cache Management

```python
from app.utils.intelligent_cache import get_intelligent_cache

cache = get_intelligent_cache()

# Get cache metrics
metrics = cache.get_cache_metrics()

# Clear specific cache
cache.clear_cache('ai_response')

# Clear all caches
cache.clear_cache()

# Get optimization recommendations
optimization = cache.optimize_cache_performance()
```

## API Endpoints

### GET /api/cache/metrics
Get comprehensive cache performance metrics including hit rates and optimization recommendations.

### GET /api/cache/status
Get current cache sizes and basic status information.

### POST /api/cache/clear?cache_type=ai_response
Clear specific cache type or all caches if no type specified.

### POST /api/cache/optimize
Get cache performance analysis and optimization recommendations.

## Monitoring

### Cache Metrics

The system tracks:
- Hit/miss rates for each cache layer
- Total requests and successful hits
- Cache utilization percentages
- Performance optimization opportunities

### Example Metrics Response

```json
{
  "metrics": {
    "fingerprint": {
      "hits": 45,
      "misses": 12,
      "total_requests": 57,
      "hit_rate": 0.7895
    },
    "ai_response": {
      "hits": 23,
      "misses": 8,
      "total_requests": 31,
      "hit_rate": 0.7419
    }
  },
  "cache_sizes": {
    "fingerprint": 25,
    "ai_response": 18,
    "analysis": 12,
    "chart_config": 20
  },
  "optimization": {
    "recommendations": [
      "ai_response cache has excellent hit rate (74.19%). Current configuration is optimal."
    ]
  }
}
```

## Performance Benefits

### Expected Improvements

1. **Data Analysis**: 70-90% faster for similar datasets
2. **AI Responses**: 80-95% faster for similar prompts
3. **Chart Recommendations**: 60-80% faster for similar data patterns
4. **Memory Usage**: Reduced by avoiding redundant computations

### Cache Hit Rate Targets

- **Fingerprint Cache**: >60% (datasets with similar structures)
- **AI Response Cache**: >40% (common analysis patterns)
- **Analysis Cache**: >30% (repeated dataset uploads)
- **Chart Config Cache**: >50% (similar data types)

## Configuration

### TTL Values

Configured based on data volatility and usage patterns:
- Short TTL (15 min): Analysis results (may change with algorithm updates)
- Medium TTL (30-45 min): AI responses and chart configs
- Long TTL (1 hour): Data fingerprints (structural data rarely changes)

### Cache Sizes

Optimized for memory usage vs. hit rate:
- Fingerprint: 500 items (lightweight, high reuse)
- AI Response: 200 items (larger objects, medium reuse)
- Analysis: 100 items (large objects, lower reuse)
- Chart Config: 300 items (medium objects, high reuse)

## Thread Safety

The caching system is thread-safe using:
- `threading.RLock()` for all cache operations
- Atomic operations for metrics updates
- Safe concurrent access to all cache layers

## Integration Points

### Agent Pipeline
- Automatic fingerprint generation
- Cache-first analysis retrieval
- Metrics collection and reporting

### Individual Agents
- AI response caching in profiler and recommender agents
- Prompt hash generation for consistent caching
- Fallback handling for cache misses

### API Layer
- Cache management endpoints
- Performance monitoring
- Administrative controls

## Troubleshooting

### Low Hit Rates
- Check if datasets are truly similar
- Verify fingerprinting algorithm accuracy
- Consider adjusting TTL values

### High Memory Usage
- Reduce cache sizes in configuration
- Implement more aggressive TTL policies
- Monitor cache utilization metrics

### Performance Issues
- Use optimization endpoint for recommendations
- Clear caches if corruption suspected
- Monitor cache metrics for bottlenecks