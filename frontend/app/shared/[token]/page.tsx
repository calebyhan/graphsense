'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { BarChart3, ExternalLink, Download, AlertCircle, Loader2 } from 'lucide-react';
import { SharingService, SharedVisualization } from '@/lib/services/sharingService';
import { useSharedVisualizationQuery } from '@/lib/api/sharingQueries';
import ChartRenderer from '@/components/visualization/ChartRenderer';
import ExportButton from '@/components/canvas/ExportButton';
import { useRef } from 'react';

export default function SharedVisualizationPage() {
  const { token } = useParams();
  const chartRef = useRef<HTMLDivElement>(null);

  // Validate token format
  const isValidToken = token && typeof token === 'string' && SharingService.isValidShareToken(token);
  
  // Use React Query to fetch shared visualization
  const { 
    data: visualization, 
    isLoading: loading, 
    error: queryError 
  } = useSharedVisualizationQuery(token as string, isValidToken);

  // Format error message
  const error = !isValidToken 
    ? (typeof token !== 'string' ? 'Invalid share token' : 'Invalid share token format')
    : queryError
    ? 'Failed to load shared chart'
    : (!visualization && !loading ? 'This shared chart could not be found or is no longer available' : '');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading shared chart...</p>
        </div>
      </div>
    );
  }

  if (error || !visualization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Chart Not Found
            </h1>
            <p className="text-gray-600 mb-6">
              {error || 'This shared chart could not be found or is no longer available.'}
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Create Your Own Chart
            </a>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Auto Visualization Agent
                </h1>
                <p className="text-sm text-gray-600">Shared Chart</p>
              </div>
            </div>
            <a
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Create Your Own
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Chart Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {visualization.title}
              </h2>
              {visualization.description && (
                <p className="text-gray-600 mb-4">
                  {visualization.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-4 w-4" />
                  {visualization.chartType.replace('_', ' ')} chart
                </span>
                <span>
                  Shared on {formatDate(visualization.createdAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ExportButton
                elementRef={chartRef}
                chartType={visualization.chartType}
                filename={`shared_${visualization.title.replace(/\s+/g, '_').toLowerCase()}`}
              />
            </div>
          </div>

          {/* Chart */}
          <div ref={chartRef} className="chart-export-container mb-6">
            <ChartRenderer
              config={visualization.chartConfig}
              chartType={visualization.chartType as any}
            />
          </div>

          {/* Chart Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              About This Chart
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Chart Type:</span>
                <span className="ml-2 font-medium text-gray-900 capitalize">
                  {visualization.chartType.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Data Points:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {visualization.chartConfig.data?.length || 0}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Created:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {formatDate(visualization.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-8 text-center">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Create Your Own AI-Powered Charts
            </h3>
            <p className="text-gray-600 mb-6">
              Upload your dataset and let our 3-agent AI pipeline analyze your data and recommend the best visualizations.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <BarChart3 className="h-5 w-5" />
              Get Started for Free
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}