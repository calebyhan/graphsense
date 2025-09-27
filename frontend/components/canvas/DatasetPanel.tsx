'use client';

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { X, Upload, Database, Brain, CheckCircle, TrendingUp, BarChart3, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import DropZone from '@/components/upload/DropZone';
import AgentProgress from '@/components/analysis/AgentProgress';

export default function DatasetPanel() {
  const { isDatasetPanelOpen, setDatasetPanelOpen, addElement } = useCanvasStore();
  const {
    rawData,
    dataProfile,
    agentStates,
    recommendations,
    selectChart,
    setRawData,
    updateAgentState,
    setDataProfile,
    setPatterns,
    setRecommendations,
    startAnalysis,
    errorType,
    showErrorNotification,
    setShowErrorNotification,
    retryAnalysis
  } = useAnalysisStore();

  const [activeTab, setActiveTab] = useState<'upload' | 'data' | 'analysis'>('upload');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const handleClose = () => {
    setDatasetPanelOpen(false);
  };

  const handleAddToCanvas = (type: 'dataset' | 'chart', data?: any) => {
    console.log('handleAddToCanvas called:', { type, data });
    const canvasCenter = { x: 400, y: 300 }; // Default center position

    if (type === 'dataset' && rawData) {
      console.log('Adding dataset to canvas');
      addElement({
        type: 'dataset',
        position: { x: canvasCenter.x, y: canvasCenter.y },
        size: { width: 400, height: 300 },
        data: { rawData, dataProfile }
      });

      // Auto-switch to analysis tab if we have recommendations or if analysis is in progress
      if (recommendations && recommendations.length > 0) {
        setActiveTab('analysis');
      } else if (agentStates.profiler !== 'idle' || agentStates.recommender !== 'idle' || agentStates.validator !== 'idle') {
        // Analysis is in progress, switch to analysis tab to show progress
        setActiveTab('analysis');
      }
    } else if (type === 'chart' && data) {
      console.log('Adding chart to canvas');
      // Find recommendation by title match or by config object reference
      const recommendation = recommendations?.find(rec => 
        (data.title && rec.config?.title === data.title) ||
        rec.config === data
      );
      
      // Ensure we have a title for the chart
      const chartTitle = data.title || 
                        (data.xAxis && data.yAxis ? `${data.yAxis} vs ${data.xAxis}` : null) ||
                        (data.category && data.value ? `${data.value} by ${data.category}` : null) ||
                        `${recommendation?.chartType || 'Chart'} Visualization`;
      
      console.log('Chart details:', { recommendation, chartTitle, originalData: data });
      
      addElement({
        type: 'chart',
        position: { x: canvasCenter.x + 100, y: canvasCenter.y + 100 },
        size: { width: 500, height: 400 },
        data: {
          config: {
            ...data,
            title: chartTitle
          },
          chartType: recommendation?.chartType || 'bar',
          recommendation,
          title: chartTitle
        }
      });
      console.log('Chart added to canvas successfully');
    } else {
      console.warn('handleAddToCanvas: Invalid type or missing data', { type, data, hasRawData: !!rawData });
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadStatus('uploading');
    setFileName(file.name);
    setError('');

    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          if (results.errors.length > 0) {
            const errorMessages = results.errors.map(err => err.message).join(', ');
            setError(`CSV parsing error: ${errorMessages}`);
            setUploadStatus('error');
            return;
          }

          if (results.data.length === 0) {
            setError('The CSV file appears to be empty or has no valid data rows.');
            setUploadStatus('error');
            return;
          }

          if (results.data.length > 10000) {
            setError('File too large. Please upload a CSV with fewer than 10,000 rows.');
            setUploadStatus('error');
            return;
          }

          setRawData(results.data);
          setUploadStatus('success');
          setActiveTab('data'); // Auto-switch to data tab

          // Automatically start the 3-agent analysis
          try {
            await startAnalysis(results.data as Array<Record<string, any>>, file.name);
          } catch (analysisError) {
            console.warn('Analysis failed to start automatically:', analysisError);
            // Don't change upload status - file was parsed successfully
          }
        },
        error: (error) => {
          setError(`Failed to parse CSV file: ${error.message}`);
          setUploadStatus('error');
        }
      });
    } catch (err) {
      setError('Unexpected error occurred while processing the file.');
      setUploadStatus('error');
    }
  };

  const handleSelectChart = (chartConfig: any) => {
    if (!chartConfig) {
      console.warn('handleSelectChart called with invalid chartConfig:', chartConfig);
      return;
    }
    console.log('handleSelectChart called with config:', chartConfig);
    selectChart(chartConfig);
    handleAddToCanvas('chart', chartConfig);
  };

  // Backend analysis is handled by the store, we just need to track when it's complete
  const checkAnalysisComplete = () => {
    const { profiler, recommender, validator } = agentStates;
    return profiler === 'complete' && recommender === 'complete' && validator === 'complete';
  };

  // Auto-switch to analysis tab when backend analysis completes
  useEffect(() => {
    if (checkAnalysisComplete() && !hasAnalyzed) {
      setActiveTab('analysis');
      setHasAnalyzed(true);
    }
  }, [agentStates, hasAnalyzed]);

  const resetUpload = () => {
    setUploadStatus('idle');
    setFileName('');
    setError('');
    setRawData(null);
    setHasAnalyzed(false);
  };

  if (!isDatasetPanelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-25 z-40"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-96 glass-effect shadow-figma-xl z-50 transform transition-transform duration-300 ease-in-out animate-slide-in-right border-l border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Data Sources</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Upload className="h-4 w-4 mx-auto mb-1" />
            Upload
          </button>
          <button
            onClick={() => setActiveTab('data')}
            disabled={!rawData}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'data'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                : rawData ? 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            <Database className="h-4 w-4 mx-auto mb-1" />
            Data
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            disabled={!rawData}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'analysis'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                : rawData ? 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            <Brain className="h-4 w-4 mx-auto mb-1" />
            Analysis
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'upload' && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Upload Dataset</h3>

              {uploadStatus === 'success' ? (
                <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900 dark:text-green-100">File Uploaded Successfully</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{fileName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetUpload}
                    className="h-auto p-0 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    Upload different file
                  </Button>
                </Card>
              ) : (
                <>
                  <DropZone onFileUpload={handleFileUpload} />

                  {uploadStatus === 'uploading' && (
                    <div className="mt-4 flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <span className="text-sm text-gray-600">Processing {fileName}...</span>
                    </div>
                  )}

                  {uploadStatus === 'error' && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-red-800">Upload Failed</p>
                          <p className="text-xs text-red-700 mt-1">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {rawData && (
                <Card className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-indigo-600" />
                    <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Dataset Ready</span>
                  </div>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-3">
                    {rawData.length} rows • {Object.keys(rawData[0] || {}).length} columns
                  </p>
                  <Button
                    onClick={() => handleAddToCanvas('dataset')}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-sm"
                    size="sm"
                  >
                    Add to Canvas
                  </Button>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'data' && rawData && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">Data Preview</h3>
                <span className="text-xs text-gray-500">
                  {rawData.length} rows
                </span>
              </div>

              {/* Data Quality */}
              {dataProfile && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Data Quality</h4>
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      dataProfile.dataQuality === 'high' ? 'bg-green-100 text-green-800' :
                      dataProfile.dataQuality === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {dataProfile.dataQuality.toUpperCase()}
                    </div>
                    <span className="text-sm text-blue-700">Quality Score</span>
                  </div>
                </div>
              )}

              {/* Column Information */}
              <div className="space-y-2 mb-4">
                <h4 className="text-sm font-medium text-gray-900">Columns</h4>
                {Object.keys(rawData[0] || {}).slice(0, 5).map((column, index) => {
                  const profile = dataProfile?.columns.find(col => col.name === column);
                  return (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700 truncate">{column}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        profile?.type === 'numeric' ? 'bg-blue-100 text-blue-800' :
                        profile?.type === 'categorical' ? 'bg-green-100 text-green-800' :
                        profile?.type === 'temporal' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {profile?.type || 'text'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Sample Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(rawData[0] || {}).slice(0, 3).map((column, index) => (
                        <th key={index} className="px-2 py-1 text-left text-gray-600">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.slice(0, 5).map((row, index) => (
                      <tr key={index} className="border-t border-gray-100">
                        {Object.keys(rawData[0] || {}).slice(0, 3).map((column, colIndex) => (
                          <td key={colIndex} className="px-2 py-1 text-gray-700">
                            <div className="truncate max-w-20">
                              {String(row[column])}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => handleAddToCanvas('dataset')}
                className="mt-4 w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                Add Dataset to Canvas
              </button>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">AI Analysis</h3>

              {/* Agent Progress */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Analysis Progress</h4>
                <AgentProgress 
                  agentStates={agentStates}
                  errorType={errorType}
                  showErrorNotification={showErrorNotification}
                  onCloseErrorNotification={() => setShowErrorNotification(false)}
                  onRetryAnalysis={retryAnalysis}
                />
              </div>

              {/* Recommendations or Analysis Status */}
              {recommendations && recommendations.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Chart Recommendations</h4>
                  <div className="space-y-3">
                    {recommendations.map((rec, index) => (
                      <div
                        key={index}
                        className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors"
                        onClick={() => rec.config && handleSelectChart(rec.config)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-gray-900">
                              {rec.config?.title || 'Untitled Chart'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {rec.confidence}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">
                          {rec.justification}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded text-xs ${
                            rec.chartType === 'line' ? 'bg-blue-100 text-blue-800' :
                            rec.chartType === 'bar' ? 'bg-green-100 text-green-800' :
                            rec.chartType === 'scatter' ? 'bg-purple-100 text-purple-800' :
                            rec.chartType === 'pie' ? 'bg-pink-100 text-pink-800' :
                            rec.chartType === 'area' ? 'bg-indigo-100 text-indigo-800' :
                            rec.chartType === 'treemap' ? 'bg-yellow-100 text-yellow-800' :
                            rec.chartType === 'histogram' ? 'bg-teal-100 text-teal-800' :
                            rec.chartType === 'box_plot' ? 'bg-orange-100 text-orange-800' :
                            rec.chartType === 'heatmap' ? 'bg-red-100 text-red-800' :
                            rec.chartType === 'sankey' ? 'bg-cyan-100 text-cyan-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {rec.chartType}
                          </span>
                          <button 
                            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent parent div click
                              if (rec.config) handleSelectChart(rec.config);
                            }}
                          >
                            Add to Canvas
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Analysis Status or Start Analysis */}
                  {agentStates.profiler === 'idle' && agentStates.recommender === 'idle' && agentStates.validator === 'idle' ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Ready for Analysis</span>
                      </div>
                      <p className="text-sm text-blue-700 mb-3">
                        Start AI-powered analysis to get intelligent chart recommendations for your dataset.
                      </p>
                      <button
                        onClick={() => {
                          if (rawData) {
                            startAnalysis(rawData, fileName || 'dataset');
                          }
                        }}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                        disabled={!rawData}
                      >
                        Start Analysis
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-5 w-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">Analysis in Progress</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Our AI agents are analyzing your dataset. This typically takes 20-40 seconds.
                      </p>
                      <div className="text-xs text-gray-500">
                        The analysis tab will automatically show recommendations when complete.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}