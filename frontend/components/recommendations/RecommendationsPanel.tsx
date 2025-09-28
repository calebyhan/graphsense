'use client';

import { useAnalysisStore } from '@/store/useAnalysisStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import RecommendationCard from './RecommendationCard';
import { Lightbulb } from 'lucide-react';

export default function RecommendationsPanel() {
  const { recommendations, selectedChart, selectChart } = useAnalysisStore();
  const { addElement } = useCanvasStore();

  const handleAddToCanvas = (recommendation: any) => {
    console.log('🎯 RecommendationsPanel: Adding to canvas', recommendation);
    console.log('🔍 Recommendation config details:', {
      hasConfig: !!recommendation.config,
      hasData: !!recommendation.config?.data,
      dataLength: recommendation.config?.data?.length,
      configKeys: recommendation.config ? Object.keys(recommendation.config) : [],
      sampleData: recommendation.config?.data?.slice(0, 2)
    });
    
    // Ensure we have a title for the chart
    const chartTitle = recommendation.config?.title || 
                      (recommendation.config?.xAxis && recommendation.config?.yAxis ? 
                        `${recommendation.config.yAxis} vs ${recommendation.config.xAxis}` : null) ||
                      (recommendation.config?.category && recommendation.config?.value ? 
                        `${recommendation.config.value} by ${recommendation.config.category}` : null) ||
                      `${recommendation.chartType} Visualization`;

    const newElement = {
      type: 'chart' as const,
      position: { x: 100, y: 100 },
      size: { width: 500, height: 400 },
      data: {
        config: {
          ...recommendation.config,
          title: chartTitle
        },
        chartType: recommendation.chartType,
        recommendation: recommendation,
        title: chartTitle
      }
    };

    addElement(newElement);
    console.log('RecommendationsPanel: Chart added to canvas successfully');
  };

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-yellow-500" />
        <h3 className="text-lg font-semibold text-gray-900">
          Chart Recommendations
        </h3>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Our AI agents analyzed your data and recommend the following visualizations based on your data characteristics and patterns.
      </p>

      <div className="space-y-4">
        {recommendations.map((recommendation, index) => (
          <RecommendationCard
            key={index}
            recommendation={recommendation}
            onSelect={() => selectChart(recommendation.config)}
            onAddToCanvas={() => handleAddToCanvas(recommendation)}
            isSelected={selectedChart?.title === recommendation.config?.title}
          />
        ))}
      </div>

      {recommendations.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No recommendations available yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Upload a dataset to get started.
          </p>
        </div>
      )}
    </div>
  );
}