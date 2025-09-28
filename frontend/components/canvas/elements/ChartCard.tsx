'use client';

import React, { useRef, memo } from 'react';
import { BarChart3, Info } from 'lucide-react';
import ChartRenderer from '@/components/visualization/ChartRenderer';
import ExportButton from '../ExportButton';

interface ChartCardProps {
  config: any;
  chartType: 'line' | 'bar' | 'scatter' | 'pie' | 'heatmap' | 'histogram' | 'box_plot' | 'treemap' | 'sankey' | 'area';
  recommendation?: any;
  title?: string;
}

const ChartCard = memo(({ config, chartType, recommendation, title }: ChartCardProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Debug logging for ChartCard
  console.log('ChartCard rendered:', { 
    chartType, 
    hasConfig: !!config, 
    configKeys: config ? Object.keys(config) : [],
    hasData: !!config?.data,
    dataLength: config?.data?.length,
    title,
    sampleConfig: config
  });

  // Generate intelligent title for chart
  const getChartTitle = () => {
    // Use provided title first
    if (title && title !== 'Untitled Chart') return title;

    // Use config title if available and not generic
    if (config?.title && config.title !== 'Untitled Chart') return config.title;

    // Generate title based on chart configuration
    if (config?.xAxis && config?.yAxis) {
      return `${config.yAxis} vs ${config.xAxis}`;
    } else if (config?.category && config?.value) {
      return `${config.value} by ${config.category}`;
    } else if (config?.xAxis) {
      return `Distribution of ${config.xAxis}`;
    }

    // Fallback to chart type
    return chartType ? `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart` : 'Chart';
  };

  return (
    <div className="chart-card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {getChartTitle()}
          </span>
        </div>

        <ExportButton
          elementRef={chartRef}
          chartType={chartType}
          filename={getChartTitle().toLowerCase().replace(/\s+/g, '-')}
          className="scale-75"
        />
      </div>

      {/* Chart */}
      <div ref={chartRef} className="flex-1 overflow-hidden">
        {config ? (
          <ChartRenderer config={config} chartType={chartType} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm">No chart data</p>
            </div>
          </div>
        )}
      </div>

      {/* Recommendation Info */}
      {recommendation && (
        <div className="mt-3 p-2 bg-accent border border-border rounded text-xs">
          <div className="flex items-start gap-1">
            <Info className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">
                Confidence: {recommendation.confidence}%
              </p>
              <p className="text-muted-foreground line-clamp-2">
                {recommendation.justification}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ChartCard;