'use client';

import { ChartRecommendation } from '@/lib/types';
import { TrendingUp, BarChart3, LineChart, Circle, PieChart, Activity, BarChart2, TreePine, Share2, Square } from 'lucide-react';

interface RecommendationCardProps {
  recommendation: ChartRecommendation;
  onSelect: () => void;
  isSelected?: boolean;
}

const chartIcons = {
  line: LineChart,
  bar: BarChart3,
  scatter: Circle,
  pie: PieChart,
  histogram: BarChart2,
  box_plot: Square,
  heatmap: Activity,
  area: Activity,
  treemap: TreePine,
  sankey: Share2
};

const chartColors = {
  line: 'text-blue-500',
  bar: 'text-green-500',
  scatter: 'text-purple-500',
  pie: 'text-orange-500',
  histogram: 'text-indigo-500',
  box_plot: 'text-cyan-500',
  heatmap: 'text-red-500',
  area: 'text-pink-500',
  treemap: 'text-emerald-500',
  sankey: 'text-violet-500'
};

export default function RecommendationCard({
  recommendation,
  onSelect,
  isSelected = false
}: RecommendationCardProps) {
  const Icon = chartIcons[recommendation.chartType] || TrendingUp;
  const iconColor = chartColors[recommendation.chartType] || 'text-gray-500';

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 65) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getDataMappingText = () => {
    const { config } = recommendation;
    const parts = [];

    if (config.xAxis) parts.push(`X: ${config.xAxis}`);
    if (config.yAxis) parts.push(`Y: ${config.yAxis}`);
    if (config.category) parts.push(`Category: ${config.category}`);
    if (config.value) parts.push(`Value: ${config.value}`);

    return parts.join(' • ');
  };

  return (
    <div
      className={`
        bg-white rounded-lg shadow-sm border-2 p-4 cursor-pointer transition-all duration-200
        ${isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
        }
      `}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <h3 className="font-semibold capitalize text-gray-900">
            {recommendation.chartType} Chart
          </h3>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full border ${getConfidenceColor(recommendation.confidence)}`}
        >
          {recommendation.confidence}% confidence
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-3 leading-relaxed">
        {recommendation.justification}
      </p>

      {getDataMappingText() && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Data Mapping:</p>
          <p className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded">
            {getDataMappingText()}
          </p>
        </div>
      )}

      <button
        className={`
          w-full py-2 px-4 rounded-md font-medium text-sm transition-colors
          ${isSelected
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }
        `}
      >
        {isSelected ? 'Selected' : 'Select Chart'}
      </button>
    </div>
  );
}