import { useState, useEffect, useMemo } from 'react';
import { analyzePerformance, sampleDataIntelligently, type PerformanceMetrics } from '@/lib/utils/performance';

interface UseChartPerformanceOptions {
  chartType: string;
  data?: any[];
  enableSampling?: boolean;
  preserveOutliers?: boolean;
  timeSeriesField?: string;
}

interface ChartPerformanceResult {
  processedData: any[] | null;
  metrics: PerformanceMetrics | null;
  isProcessing: boolean;
  shouldShowWarning: boolean;
  performanceInfo: {
    originalSize: number;
    processedSize: number;
    samplingRatio: number;
    estimatedSavings: string;
  } | null;
}

/**
 * Hook for optimizing chart data performance
 */
export function useChartPerformance({
  chartType,
  data,
  enableSampling = true,
  preserveOutliers = false,
  timeSeriesField
}: UseChartPerformanceOptions): ChartPerformanceResult {
  const [isProcessing, setIsProcessing] = useState(false);

  // Analyze performance characteristics
  const metrics = useMemo(() => {
    if (!data || data.length === 0) return null;
    return analyzePerformance(data.length, chartType);
  }, [data?.length, chartType]);

  // Process data with intelligent sampling
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return null;
    if (!enableSampling || !metrics?.shouldSample) return data;

    setIsProcessing(true);
    
    try {
      const sampled = sampleDataIntelligently(
        data, 
        metrics.recommendedMaxPoints, 
        chartType,
        { preserveOutliers, timeSeriesField }
      );
      
      return sampled;
    } finally {
      setIsProcessing(false);
    }
  }, [data, enableSampling, metrics, chartType, preserveOutliers, timeSeriesField]);

  // Performance information for UI display
  const performanceInfo = useMemo(() => {
    if (!data || !processedData || !metrics) return null;

    const originalSize = data.length;
    const processedSize = processedData.length;
    const samplingRatio = processedSize / originalSize;
    
    // Estimate performance savings
    const estimatedSavings = samplingRatio < 1 
      ? `~${Math.round((1 - samplingRatio) * 100)}% faster`
      : 'No sampling applied';

    return {
      originalSize,
      processedSize,
      samplingRatio,
      estimatedSavings
    };
  }, [data, processedData, metrics]);

  const shouldShowWarning = useMemo(() => {
    return Boolean(metrics?.isLargeDataset && metrics.estimatedRenderTime > 1000);
  }, [metrics]);

  return {
    processedData,
    metrics,
    isProcessing,
    shouldShowWarning,
    performanceInfo
  };
}

/**
 * Hook for monitoring chart render performance
 */
export function useRenderPerformance(chartType: string, dataSize?: number) {
  const [renderTime, setRenderTime] = useState<number | null>(null);
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      setRenderTime(duration);
      setRenderCount(prev => prev + 1);
      
      // Log performance in development
      if (process.env.NODE_ENV === 'development' && dataSize) {
        console.log(`📊 ${chartType} render:`, {
          duration: `${duration.toFixed(2)}ms`,
          dataSize,
          renderCount: renderCount + 1,
          avgTimePerPoint: dataSize > 0 ? (duration / dataSize).toFixed(4) + 'ms' : 'N/A'
        });
      }
    };
  }, [chartType, dataSize, renderCount]);

  return { renderTime, renderCount };
}

/**
 * Hook for canvas viewport optimization
 */
export function useCanvasOptimization() {
  const [visibleElements, setVisibleElements] = useState<string[]>([]);
  
  // Simple viewport-based element visibility
  const updateVisibleElements = useMemo(() => {
    return (elementIds: string[], viewport: { x: number; y: number; zoom: number }) => {
      // For now, show all elements - could be enhanced with actual viewport intersection
      setVisibleElements(elementIds);
    };
  }, []);

  return {
    visibleElements,
    updateVisibleElements
  };
}