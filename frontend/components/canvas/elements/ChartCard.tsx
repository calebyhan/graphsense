'use client';

import React, { useRef } from 'react';
import { BarChart3, Info } from 'lucide-react';
import ChartRenderer from '@/components/visualization/ChartRenderer';
import ExportButton from '../ExportButton';

interface ChartCardProps {
  config: any;
  chartType: 'line' | 'bar' | 'scatter' | 'pie' | 'heatmap';
  recommendation?: any;
  title?: string;
}

export default function ChartCard({ config, chartType, recommendation, title }: ChartCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-900">
            {title || config?.title || 'Chart'}
          </span>
        </div>

        <ExportButton
          elementRef={chartRef}
          chartType={chartType}
          filename={title || config?.title || 'chart'}
          className="scale-75"
        />
      </div>

      {/* Chart */}
      <div ref={chartRef} className="flex-1 overflow-hidden">
        {config ? (
          <ChartRenderer config={config} chartType={chartType} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No chart data</p>
            </div>
          </div>
        )}
      </div>

      {/* Recommendation Info */}
      {recommendation && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
          <div className="flex items-start gap-1">
            <Info className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900 mb-1">
                Confidence: {recommendation.confidence}%
              </p>
              <p className="text-blue-800 line-clamp-2">
                {recommendation.justification}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}