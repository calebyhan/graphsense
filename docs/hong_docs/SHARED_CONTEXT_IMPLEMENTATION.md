# Shared Data Context Implementation

## Overview

This implementation introduces a shared data context system between agents to optimize data processing and eliminate redundant calculations. The system addresses performance requirements 2.1 and 2.5 by implementing efficient data passing and reusing statistical summaries across the agent pipeline.

## Key Components

### 1. ProcessingContext Class (`app/models/processing_context.py`)

The `ProcessingContext` class serves as a shared data container that:

- **Stores sample data**: Maintains a single DataFrame reference used by all agents
- **Caches statistical computations**: Avoids recalculating statistics across agents
- **Tracks memory usage**: Monitors resource consumption
- **Provides column metadata**: Cached column type information for reuse
- **Manages correlation matrices**: Reuses correlation calculations

Key features:
- **Memory efficient**: Passes data references instead of copying
- **Cache-aware**: Stores intermediate results for reuse
- **Type-aware**: Provides helper methods for column type queries
- **Memory tracking**: Monitors and reports memory usage

### 2. Enhanced Agent Methods

#### Profiler Agent (`analyze_with_context`)
- Uses cached statistical computations when available
- Stores results in context for other agents
- Implements cache-aware analysis methods:
  - `_statistical_analysis_with_cache()`
  - `_correlation_analysis_with_cache()`
  - `_pattern_analysis_with_cache()`
  - `_data_quality_analysis_with_cache()`

#### Recommender Agent (`recommend_with_context`)
- Leverages cached profiler results
- Uses cached column metadata for chart type decisions
- Implements context-aware recommendation generation
- Provides fallback recommendations using cached data

#### Validation Agent (`validate_with_context`)
- Uses cached analysis results for validation
- Leverages cached data quality metrics
- Implements context-aware validation scoring

### 3. Updated Agent Pipeline (`analyze_dataset_with_shared_context`)

The pipeline now:
1. **Creates shared context**: Initializes ProcessingContext with sampled data
2. **Passes context between agents**: Each agent receives the same context object
3. **Reuses computations**: Agents check cache before performing calculations
4. **Manages memory**: Tracks usage and cleans up after processing
5. **Maintains compatibility**: Original methods remain for backward compatibility

## Performance Benefits

### Memory Optimization
- **Single data copy**: Sample data stored once in context, referenced by all agents
- **Cached computations**: Statistical summaries calculated once, reused multiple times
- **Memory tracking**: Monitors usage to prevent memory exhaustion

### Processing Efficiency
- **Reduced redundancy**: Eliminates duplicate statistical calculations
- **Faster agent transitions**: Data already available in context
- **Cache hits**: Reuses previous computations when possible

### Data Flow Optimization
- **Reference passing**: Agents work with data references, not copies
- **Shared metadata**: Column type information computed once, used by all agents
- **Context persistence**: Intermediate results available throughout pipeline

## Usage Example

```python
# Create pipeline service
pipeline = AgentPipelineService()

# Analyze dataset with shared context (default behavior)
result = await pipeline.analyze_dataset(
    data=sample_data,
    dataset_id="dataset_001"
)

# Or explicitly use shared context
result = await pipeline.analyze_dataset_with_shared_context(
    data=sample_data,
    dataset_id="dataset_001"
)
```

## Cache Management

The ProcessingContext provides several caching mechanisms:

```python
# Statistical caching
context.cache_statistic("correlations", correlation_data)
cached_corr = context.get_cached_statistic("correlations")

# Column metadata caching
context.cache_column_metadata("age", {"data_type": "numeric"})
age_meta = context.get_column_metadata("age")

# Data quality caching
context.cache_data_quality("completeness", 0.95)
completeness = context.get_cached_data_quality("completeness")

# Helper methods for column types
numeric_cols = context.get_numeric_columns()
categorical_cols = context.get_categorical_columns()
```

## Memory Management

The system includes memory tracking and cleanup:

```python
# Update memory usage
context.update_memory_usage()

# Get memory statistics
memory_bytes = context.memory_usage_bytes

# Clear cache to free memory
context.clear_cache()

# Get cache summary for monitoring
summary = context.get_cache_summary()
```

## Backward Compatibility

The implementation maintains backward compatibility:
- Original `analyze_dataset()` now uses shared context by default
- Legacy method `analyze_dataset_legacy()` preserves old behavior
- All existing API contracts remain unchanged

## Requirements Addressed

- **Requirement 2.1**: ✅ Optimized data passing between sequential agents
- **Requirement 2.5**: ✅ Reused statistical summaries to avoid redundant calculations

## Testing

A test script is provided at `backend/test_shared_context.py` to verify:
- ProcessingContext creation and caching
- Context-aware agent pipeline execution
- Memory usage tracking
- Cache management functionality

## Future Enhancements

Potential improvements:
- **Persistent caching**: Store context data across requests
- **Cache eviction policies**: Implement LRU or TTL-based cache cleanup
- **Parallel processing**: Enable concurrent agent execution with shared context
- **Context serialization**: Save/load context for debugging or analysis