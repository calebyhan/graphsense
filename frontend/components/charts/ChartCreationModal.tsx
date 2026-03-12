'use client';

import React, { useState, useEffect } from 'react';
import { X, BarChart3, LineChart, Circle, PieChart, Activity, BarChart2, TreePine, Share2, Square } from 'lucide-react';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { getActiveWebSocket } from '@/lib/realtime/canvasWebSocket';
import ChartRenderer from '@/components/visualization/ChartRenderer';
import { ChartConfig, DatasetAttributes } from '@/lib/types';
import { ChartParameterExtractor, ChartType } from '@/lib/services/chartParameterExtractor';
import { DatasetAttributeBuilder } from '@/lib/services/datasetAttributeBuilder';

interface ChartCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const chartTypes = [
  { type: 'line', icon: LineChart, label: 'Line Chart', description: 'Show trends over time' },
  { type: 'bar', icon: BarChart3, label: 'Bar Chart', description: 'Compare categories' },
  { type: 'scatter', icon: Circle, label: 'Scatter Plot', description: 'Show relationships' },
  { type: 'pie', icon: PieChart, label: 'Pie Chart', description: 'Show proportions' },
  { type: 'histogram', icon: BarChart2, label: 'Histogram', description: 'Show distributions' },
  { type: 'box_plot', icon: Square, label: 'Box Plot', description: 'Show statistical summary' },
  { type: 'heatmap', icon: Activity, label: 'Heatmap', description: 'Show correlation matrix' },
  { type: 'area', icon: Activity, label: 'Area Chart', description: 'Show cumulative trends' },
  { type: 'treemap', icon: TreePine, label: 'Treemap', description: 'Show hierarchical data' },
  { type: 'sankey', icon: Share2, label: 'Sankey Diagram', description: 'Show flow between nodes' }
] as const;

export default function ChartCreationModal({ isOpen, onClose }: ChartCreationModalProps) {
  const { parsedData, dataProfile } = useAnalysisStore();
  const { addElement } = useCanvasStore();

  const [selectedChartType, setSelectedChartType] = useState<string>('bar');
  const [chartConfig, setChartConfig] = useState<Partial<ChartConfig>>({
    title: 'My Chart',
    xAxis: '',
    yAxis: '',
    category: '',
    value: '',
    color: '',
    data: []
  });
  const [previewConfig, setPreviewConfig] = useState<ChartConfig | null>(null);
  const [datasetAttributes, setDatasetAttributes] = useState<DatasetAttributes | null>(null);

  // Build dataset attributes when data changes
  useEffect(() => {
    if (parsedData) {
      const attributes = DatasetAttributeBuilder.buildDatasetAttributes(parsedData, dataProfile || undefined);
      setDatasetAttributes(attributes);
    }
  }, [parsedData, dataProfile]);

  // Auto-configure chart when type or attributes change
  useEffect(() => {
    if (datasetAttributes && selectedChartType) {
      const autoConfig = ChartParameterExtractor.extractChartConfig(
        selectedChartType as ChartType,
        datasetAttributes
      );
      setChartConfig(autoConfig);
    }
  }, [datasetAttributes, selectedChartType]);

  const columns = parsedData ? Object.keys(parsedData[0] || {}) : [];
  const numericColumns = columns.filter(col => {
    if (!parsedData) return false;
    const sampleValue = parsedData[0]?.[col];
    return !isNaN(Number(sampleValue)) && sampleValue !== null && sampleValue !== '';
  });
  const categoricalColumns = columns.filter(col => !numericColumns.includes(col));

  useEffect(() => {
    if (parsedData && chartConfig.xAxis && chartConfig.yAxis) {
      updatePreview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartConfig, selectedChartType, parsedData]);

  const updatePreview = () => {
    if (!parsedData) return;

    const config: ChartConfig = {
      title: chartConfig.title || 'Preview Chart',
      data: parsedData,
      xAxis: chartConfig.xAxis,
      yAxis: chartConfig.yAxis,
      category: chartConfig.category,
      value: chartConfig.value,
      color: chartConfig.color,
    };

    setPreviewConfig(config);
  };

  const handleAddToCanvas = () => {
    if (!previewConfig) return;

    // Position chart in viewport center
    const { viewport } = useCanvasStore.getState();
    const viewportCenter = useCanvasStore.getState().getViewportCenterPosition();
    console.log('🎯 ChartCreationModal: Positioning chart', {
      viewport,
      viewportCenter,
      previewConfig
    });
    const newElement = {
      type: 'chart' as const,
      position: viewportCenter,
      size: { width: 400, height: 300 },
      data: {
        config: previewConfig,
        chartType: selectedChartType,
        title: chartConfig.title
      }
    };

    const id = addElement(newElement);
    getActiveWebSocket()?.sendElementAdd({
      id,
      type: newElement.type,
      position: newElement.position,
      size: newElement.size,
      data: newElement.data,
    });
    console.log('ChartCreationModal: Chart added to canvas at position:', viewportCenter);
    onClose();
  };

  const getRequiredFields = (chartType: string) => {
    // Define chart parameter requirements directly since CHART_PARAMETER_REQUIREMENTS doesn't exist
    const requirementsMap: Record<string, { required: string[], optional: string[] }> = {
      'line': { required: ['xAxis', 'yAxis'], optional: ['color'] },
      'bar': { required: ['xAxis', 'yAxis'], optional: ['color'] },
      'scatter': { required: ['xAxis', 'yAxis'], optional: ['color'] },
      'pie': { required: ['category', 'value'], optional: ['color'] },
      'area': { required: ['xAxis', 'yAxis'], optional: ['color'] },
      'heatmap': { required: ['xAxis', 'yAxis', 'value'], optional: ['color'] },
      'histogram': { required: ['value'], optional: [] },
      'box_plot': { required: ['value'], optional: [] },
      'treemap': { required: ['category', 'value'], optional: [] },
      'sankey': { required: ['source', 'target'], optional: ['value'] }
    };
    
    return requirementsMap[chartType] || { required: ['xAxis', 'yAxis'], optional: [] };
  };

  const requiredFields = getRequiredFields(selectedChartType);
  const isConfigValid = requiredFields.required.every((field: string) =>
    chartConfig[field as keyof ChartConfig]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create Custom Chart</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Configuration Panel */}
          <div className="w-1/3 p-6 border-r overflow-y-auto">
            {/* Chart Type Selection */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Chart Type</h3>
              <div className="grid grid-cols-2 gap-2">
                {chartTypes.map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => setSelectedChartType(type)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedChartType === type
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 mb-1" />
                    <div className="text-xs font-medium">{label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Configuration */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Chart Title
                </label>
                <input
                  type="text"
                  value={chartConfig.title || ''}
                  onChange={(e) => setChartConfig(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter chart title"
                />
              </div>

              {/* Dynamic field configuration based on chart type */}
              {requiredFields.required.includes('xAxis') && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    X-Axis <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={chartConfig.xAxis || ''}
                    onChange={(e) => setChartConfig(prev => ({ ...prev, xAxis: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select column</option>
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )}

              {requiredFields.required.includes('yAxis') && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Y-Axis <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={chartConfig.yAxis || ''}
                    onChange={(e) => setChartConfig(prev => ({ ...prev, yAxis: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select column</option>
                    {numericColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )}

              {requiredFields.required.includes('category') && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={chartConfig.category || ''}
                    onChange={(e) => setChartConfig(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select column</option>
                    {categoricalColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )}

              {requiredFields.required.includes('value') && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Value <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={chartConfig.value || ''}
                    onChange={(e) => setChartConfig(prev => ({ ...prev, value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select column</option>
                    {numericColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Optional fields */}
              {requiredFields.optional.includes('color') && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Color By (Optional)
                  </label>
                  <select
                    value={chartConfig.color || ''}
                    onChange={(e) => setChartConfig(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {categoricalColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 p-6 flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Preview</h3>

            <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              {previewConfig && isConfigValid ? (
                <div className="h-full p-4">
                  <ChartRenderer
                    config={previewConfig}
                    chartType={selectedChartType as any}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium mb-2">Chart Preview</p>
                    <p className="text-sm">
                      {!parsedData
                        ? 'No data available'
                        : !isConfigValid
                        ? 'Complete the required fields to see preview'
                        : 'Configuring chart...'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToCanvas}
                disabled={!isConfigValid || !previewConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add to Canvas
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}