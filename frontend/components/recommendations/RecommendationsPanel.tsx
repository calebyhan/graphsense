'use client';

import { useAnalysisStore } from '@/store/useAnalysisStore';
import RecommendationCard from './RecommendationCard';
import { Lightbulb } from 'lucide-react';

export default function RecommendationsPanel() {
  const { recommendations, selectedChart, selectChart } = useAnalysisStore();

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
            isSelected={selectedChart?.title === recommendation.config.title}
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