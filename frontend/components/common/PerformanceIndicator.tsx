'use client';

import React from 'react';
import { AlertTriangle, Zap, Info } from 'lucide-react';
import type { PerformanceMetrics } from '@/lib/utils/performance';

interface PerformanceIndicatorProps {
  metrics: PerformanceMetrics;
  originalSize: number;
  processedSize: number;
  className?: string;
  showDetails?: boolean;
}

export function PerformanceIndicator({ 
  metrics, 
  originalSize, 
  processedSize, 
  className = "",
  showDetails = true 
}: PerformanceIndicatorProps) {
  const isSampled = processedSize < originalSize;
  const samplingRatio = processedSize / originalSize;
  const reductionPercent = Math.round((1 - samplingRatio) * 100);

  // Determine indicator style based on performance impact
  const getIndicatorStyle = () => {
    if (metrics.estimatedRenderTime < 100) {
      return {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-200',
        icon: Zap,
        message: 'Optimal performance'
      };
    } else if (metrics.estimatedRenderTime < 1000) {
      return {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800', 
        borderColor: 'border-yellow-200',
        icon: Info,
        message: 'Good performance'
      };
    } else {
      return {
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-200', 
        icon: AlertTriangle,
        message: 'Performance optimized'
      };
    }
  };

  const style = getIndicatorStyle();
  const IconComponent = style.icon;

  if (!isSampled && metrics.estimatedRenderTime < 500) {
    // Don't show indicator for small datasets with good performance
    return null;
  }

  return (
    <div className={`
      ${style.bgColor} ${style.textColor} ${style.borderColor}
      border rounded-md px-3 py-2 text-xs font-medium
      ${className}
    `}>
      <div className="flex items-center gap-2">
        <IconComponent className="h-3 w-3" />
        
        {isSampled ? (
          <div className="flex items-center gap-2">
            <span>
              Showing {processedSize.toLocaleString()} of {originalSize.toLocaleString()} points
            </span>
            {showDetails && (
              <span className="text-xs opacity-75">
                ({reductionPercent}% reduction)
              </span>
            )}
          </div>
        ) : (
          <span>{style.message}</span>
        )}
      </div>

      {showDetails && metrics.estimatedRenderTime > 100 && (
        <div className="mt-1 text-xs opacity-75">
          Est. render time: {Math.round(metrics.estimatedRenderTime)}ms
        </div>
      )}
    </div>
  );
}

interface PerformanceWarningProps {
  metrics: PerformanceMetrics;
  onOptimize?: () => void;
}

export function PerformanceWarning({ metrics, onOptimize }: PerformanceWarningProps) {
  if (!metrics.isLargeDataset) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-amber-800 mb-1">
            Large Dataset Detected
          </h4>
          <p className="text-sm text-amber-700 mb-3">
            This visualization contains {metrics.dataSize.toLocaleString()} data points, 
            which may impact performance. Consider enabling data sampling for better performance.
          </p>
          
          <div className="text-xs text-amber-600 space-y-1">
            <div>• Estimated render time: {Math.round(metrics.estimatedRenderTime)}ms</div>
            <div>• Recommended max points: {metrics.recommendedMaxPoints.toLocaleString()}</div>
          </div>
          
          {onOptimize && (
            <button
              onClick={onOptimize}
              className="mt-3 text-sm bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-md transition-colors"
            >
              Enable Optimization
            </button>
          )}
        </div>
      </div>
    </div>
  );
}