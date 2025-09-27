'use client';

import { useRef, useState } from 'react';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import ChartRenderer from './ChartRenderer';
import ExportButton from '../canvas/ExportButton';
import ShareModal from '../common/ShareModal';
import { BarChart3, Share2, Maximize2 } from 'lucide-react';
import { ShareOptions } from '@/lib/services/sharingService';

export default function ChartContainer() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const { selectedChart, recommendations } = useAnalysisStore();

  if (!selectedChart) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">
            Visualization
          </h3>
        </div>

        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <BarChart3 className="h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-500 text-center">
            Select a chart recommendation to view the visualization
          </p>
          <p className="text-sm text-gray-400 text-center mt-1">
            Your chart will appear here once you choose a recommendation
          </p>
        </div>
      </div>
    );
  }

  const selectedRecommendation = recommendations?.find(
    rec => rec.config?.title === selectedChart?.title
  );

  const chartType = selectedRecommendation?.chartType || 'bar';

  const handleShare = () => {
    setShowShareModal(true);
  };

  const shareOptions: ShareOptions = {
    chartConfig: selectedChart,
    chartType,
    title: selectedChart?.title || 'Chart',
    description: selectedRecommendation?.justification || `Interactive ${chartType.replace('_', ' ')} chart with AI-generated insights`,
  };

  const handleFullscreen = () => {
    // TODO: Implement fullscreen view
    alert('Fullscreen view coming soon!');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedChart?.title || 'Chart'}
          </h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full capitalize">
            {chartType.replace('_', ' ')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleFullscreen}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            title="Fullscreen view"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            title="Share chart"
          >
            <Share2 className="h-4 w-4" />
          </button>

          <ExportButton
            elementRef={chartRef}
            chartType={chartType}
            filename={`${selectedChart?.title?.replace(/\s+/g, '_').toLowerCase() || 'chart'}`}
          />
        </div>
      </div>

      <div ref={chartRef} className="chart-export-container">
        <ChartRenderer config={selectedChart} chartType={chartType} />
      </div>

      {selectedRecommendation && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                AI Reasoning
              </h4>
              <p className="text-sm text-blue-800">
                {selectedRecommendation.justification}
              </p>
            </div>
            <div className="flex-shrink-0">
              <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                {Math.round(selectedRecommendation.confidence * 100)}% confidence
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareOptions={shareOptions}
      />
    </div>
  );
}