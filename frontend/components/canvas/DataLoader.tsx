'use client';

import React, { useState } from 'react';
import { Upload, Database, BarChart3, X } from 'lucide-react';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { useCanvasStore } from '@/store/useCanvasStore';

const sampleData = [
  { month: 'Jan', sales: 120, customers: 45, revenue: 15000 },
  { month: 'Feb', sales: 180, customers: 62, revenue: 23000 },
  { month: 'Mar', sales: 150, customers: 58, revenue: 19000 },
  { month: 'Apr', sales: 220, customers: 78, revenue: 31000 },
  { month: 'May', sales: 280, customers: 95, revenue: 42000 },
  { month: 'Jun', sales: 340, customers: 112, revenue: 51000 },
  { month: 'Jul', sales: 380, customers: 128, revenue: 58000 },
  { month: 'Aug', sales: 420, customers: 145, revenue: 65000 },
  { month: 'Sep', sales: 350, customers: 118, revenue: 48000 },
  { month: 'Oct', sales: 390, customers: 134, revenue: 55000 },
  { month: 'Nov', sales: 450, customers: 156, revenue: 68000 },
  { month: 'Dec', sales: 520, customers: 180, revenue: 78000 },
];

const sampleDataProfile = {
  columns: [
    { name: 'month', type: 'categorical' as const, nullCount: 0 },
    { name: 'sales', type: 'numeric' as const, nullCount: 0, stats: { min: 120, max: 520, mean: 317, std: 125 } },
    { name: 'customers', type: 'numeric' as const, nullCount: 0, stats: { min: 45, max: 180, mean: 109, std: 42 } },
    { name: 'revenue', type: 'numeric' as const, nullCount: 0, stats: { min: 15000, max: 78000, mean: 46500, std: 20000 } },
  ],
  rowCount: 12,
  dataQuality: 'high' as const,
};

const sampleRecommendations = [
  {
    chartType: 'line' as const,
    confidence: 95,
    justification: 'Line chart is ideal for showing sales trends over time periods',
    config: {
      title: 'Monthly Sales Trend',
      xAxis: 'month',
      yAxis: 'sales',
      data: sampleData,
    }
  },
  {
    chartType: 'bar' as const,
    confidence: 88,
    justification: 'Bar chart effectively compares revenue across different months',
    config: {
      title: 'Monthly Revenue',
      xAxis: 'month',
      yAxis: 'revenue',
      data: sampleData,
    }
  },
  {
    chartType: 'scatter' as const,
    confidence: 82,
    justification: 'Scatter plot reveals correlation between sales and customer count',
    config: {
      title: 'Sales vs Customers',
      xAxis: 'customers',
      yAxis: 'sales',
      data: sampleData,
    }
  },
];

export default function DataLoader() {
  const { setRawData, setDataProfile, setRecommendations, selectChart } = useAnalysisStore();
  const { addElement } = useCanvasStore();
  const [isVisible, setIsVisible] = useState(true);

  const loadSampleData = () => {
    setRawData(sampleData);
    setDataProfile(sampleDataProfile);
    setRecommendations(sampleRecommendations);
    selectChart(sampleRecommendations[0].config);

    // Add elements to canvas automatically
    addElement({
      type: 'dataset',
      position: { x: 100, y: 100 },
      size: { width: 400, height: 300 },
      data: { rawData: sampleData, dataProfile: sampleDataProfile }
    });

    addElement({
      type: 'chart',
      position: { x: 600, y: 100 },
      size: { width: 500, height: 400 },
      data: {
        config: sampleRecommendations[0].config,
        chartType: sampleRecommendations[0].chartType,
        recommendation: sampleRecommendations[0]
      }
    });

    addElement({
      type: 'chart',
      position: { x: 100, y: 500 },
      size: { width: 500, height: 400 },
      data: {
        config: sampleRecommendations[1].config,
        chartType: sampleRecommendations[1].chartType,
        recommendation: sampleRecommendations[1]
      }
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed top-6 right-6 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Quick Start</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-gray-500 hover:text-gray-700" />
          </button>
        </div>
        <div className="space-y-2">
          <button
            onClick={loadSampleData}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Database className="h-4 w-4" />
            Load Sample Data
          </button>

          <div className="text-xs text-gray-500 space-y-1">
            <p>• Adds sample sales data</p>
            <p>• Creates dataset card</p>
            <p>• Generates example charts</p>
          </div>
        </div>
      </div>
    </div>
  );
}