// Performance utilities for chart rendering optimization

export interface PerformanceMetrics {
  dataSize: number;
  isLargeDataset: boolean;
  shouldSample: boolean;
  recommendedMaxPoints: number;
  estimatedRenderTime: number;
}

// Chart-specific performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  SCATTER: { max: 1000, warning: 500 },
  LINE: { max: 2000, warning: 1000 },
  BAR: { max: 500, warning: 200 },
  HEATMAP: { max: 10000, warning: 5000 },
  PIE: { max: 100, warning: 50 },
  AREA: { max: 2000, warning: 1000 },
  TREEMAP: { max: 1000, warning: 500 },
  HISTOGRAM: { max: 10000, warning: 5000 },
  BOX_PLOT: { max: 10000, warning: 5000 },
  SANKEY: { max: 500, warning: 200 }
} as const;

export type ChartType = keyof typeof PERFORMANCE_THRESHOLDS;

/**
 * Analyze dataset performance characteristics
 */
export function analyzePerformance(
  dataSize: number, 
  chartType: string
): PerformanceMetrics {
  const normalizedChartType = chartType.toUpperCase().replace('-', '_') as ChartType;
  const threshold = PERFORMANCE_THRESHOLDS[normalizedChartType] || PERFORMANCE_THRESHOLDS.SCATTER;
  
  const isLargeDataset = dataSize > threshold.warning;
  const shouldSample = dataSize > threshold.max;
  
  // Rough estimation based on chart complexity
  const complexityMultiplier = {
    SCATTER: 1.5,
    LINE: 1.0,
    BAR: 2.0,
    HEATMAP: 3.0,
    PIE: 1.2,
    AREA: 1.1,
    TREEMAP: 2.5,
    HISTOGRAM: 1.0,
    BOX_PLOT: 1.0,
    SANKEY: 3.5
  }[normalizedChartType] || 1.0;
  
  const estimatedRenderTime = Math.min(5000, dataSize * complexityMultiplier * 0.001);
  
  return {
    dataSize,
    isLargeDataset,
    shouldSample,
    recommendedMaxPoints: threshold.max,
    estimatedRenderTime
  };
}

/**
 * Intelligent data sampling strategies
 */
export function sampleDataIntelligently(
  data: any[], 
  maxPoints: number, 
  chartType: string,
  options: {
    preserveOutliers?: boolean;
    maintainDistribution?: boolean;
    timeSeriesField?: string;
  } = {}
): any[] {
  if (!data || data.length <= maxPoints) return data;
  
  const { preserveOutliers = false, maintainDistribution = true, timeSeriesField } = options;
  
  console.log(`🎯 Smart sampling ${data.length} → ${maxPoints} points for ${chartType}`);
  
  // Time series data: systematic sampling to preserve trends
  if (chartType === 'line' || chartType === 'area' || timeSeriesField) {
    return systematicSample(data, maxPoints);
  }
  
  // Scatter plots: stratified sampling to maintain distribution
  if (chartType === 'scatter' && maintainDistribution) {
    return stratifiedSample(data, maxPoints);
  }
  
  // Histograms/Box plots: maintain statistical properties
  if (chartType === 'histogram' || chartType === 'box_plot') {
    return statisticalSample(data, maxPoints, preserveOutliers);
  }
  
  // Default: random sampling
  return randomSample(data, maxPoints);
}

/**
 * Systematic sampling for time series data
 */
function systematicSample(data: any[], maxPoints: number): any[] {
  const interval = Math.floor(data.length / maxPoints);
  return data.filter((_, index) => index % interval === 0).slice(0, maxPoints);
}

/**
 * Stratified sampling to maintain distribution
 */
function stratifiedSample(data: any[], maxPoints: number): any[] {
  // Simple implementation: divide into buckets and sample from each
  const buckets = 10;
  const bucketSize = Math.floor(data.length / buckets);
  const samplesPerBucket = Math.floor(maxPoints / buckets);
  
  const sampled: any[] = [];
  
  for (let i = 0; i < buckets; i++) {
    const bucketStart = i * bucketSize;
    const bucketEnd = Math.min(bucketStart + bucketSize, data.length);
    const bucketData = data.slice(bucketStart, bucketEnd);
    
    const bucketSamples = randomSample(bucketData, samplesPerBucket);
    sampled.push(...bucketSamples);
  }
  
  return sampled.slice(0, maxPoints);
}

/**
 * Statistical sampling preserving outliers
 */
function statisticalSample(data: any[], maxPoints: number, preserveOutliers: boolean): any[] {
  if (!preserveOutliers) {
    return randomSample(data, maxPoints);
  }
  
  // Reserve 10% of points for potential outliers
  const outlierReserve = Math.floor(maxPoints * 0.1);
  const regularSamples = maxPoints - outlierReserve;
  
  // Get regular random sample
  const regularData = randomSample(data, regularSamples);
  
  // Add some extreme values (rough outlier detection)
  const outliers: any[] = [];
  // This is a simplified outlier detection - could be enhanced
  const sorted = [...data].sort((a, b) => {
    const aVal = Object.values(a)[0] as number;
    const bVal = Object.values(b)[0] as number;
    return aVal - bVal;
  });
  
  // Take some values from extremes
  const extremeCount = Math.min(outlierReserve, Math.floor(data.length * 0.05));
  outliers.push(...sorted.slice(0, Math.floor(extremeCount / 2)));
  outliers.push(...sorted.slice(-Math.floor(extremeCount / 2)));
  
  return [...regularData, ...outliers].slice(0, maxPoints);
}

/**
 * Random sampling
 */
function randomSample(data: any[], maxPoints: number): any[] {
  const indices = new Set<number>();
  
  while (indices.size < maxPoints && indices.size < data.length) {
    indices.add(Math.floor(Math.random() * data.length));
  }
  
  return Array.from(indices)
    .sort((a, b) => a - b)
    .map(i => data[i]);
}

/**
 * Performance warning component props
 */
export interface PerformanceWarningProps {
  metrics: PerformanceMetrics;
  chartType: string;
  originalSize: number;
  sampledSize: number;
}