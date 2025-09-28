'use client';

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { X, Upload, Database, Brain, CheckCircle, TrendingUp, BarChart3, FileText, AlertCircle, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { useDatasetManager } from '@/hooks/useDatasetManager';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { Dataset } from '@/components/AutoVizAgent';
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

  // Add dataset manager for database integration
  const { user } = useAuthContext();
  const { datasets, createDatasetWithLifecycle, isCreating } = useDatasetManager({
    onDatasetCreated: (dataset) => {
      console.log('Dataset created:', dataset);
      setSelectedDataset(dataset);
      // Auto-switch to data tab to show the created dataset
      setActiveTab('data');
    }
  });

  const [activeTab, setActiveTab] = useState<'datasets' | 'upload' | 'data' | 'analysis'>('datasets');
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
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

    if (type === 'dataset') {
      // Use current data source (either uploaded rawData or selectedDataset)
      const currentData = rawData || selectedDataset?.data;
      const currentProfile = rawData ? dataProfile : null;
      
      if (currentData) {
        console.log('Adding dataset to canvas');
        addElement({
          type: 'dataset',
          position: { x: canvasCenter.x, y: canvasCenter.y },
          size: { width: 400, height: 300 },
          data: { 
            rawData: currentData, 
            dataProfile: currentProfile,
            datasetInfo: selectedDataset 
          }
        });

        // Auto-switch to analysis tab to show analysis or recommendations
        // Only switch if we're not already on the analysis tab to prevent conflicts
        if (activeTab !== 'analysis') {
          setActiveTab('analysis');
        }
      } else {
        console.warn('No dataset data available to add to canvas');
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
    if (!user) {
      setError('Please log in to upload datasets.');
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    setFileName(file.name);
    setError('');

    try {
      // Use the database lifecycle approach
      await createDatasetWithLifecycle({
        file,
        onProgress: (progress) => {
          console.log(`Upload progress: ${progress}%`);
        },
        onStatusChange: (status) => {
          console.log(`Status: ${status}`);
          if (status === 'completed') {
            setUploadStatus('success');
          } else if (status === 'failed') {
            setUploadStatus('error');
          }
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unexpected error occurred while processing the file.';
      setError(errorMessage);
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
    setSelectedDataset(null);
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
            onClick={() => setActiveTab('datasets')}
            className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === 'datasets'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FolderOpen className="h-4 w-4 mx-auto mb-1" />
            Datasets
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
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
            disabled={!rawData && !selectedDataset}
            className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === 'data'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                : (rawData || selectedDataset) ? 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            <Database className="h-4 w-4 mx-auto mb-1" />
            Data
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            disabled={!rawData && !selectedDataset}
            className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === 'analysis'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                : (rawData || selectedDataset) ? 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            <Brain className="h-4 w-4 mx-auto mb-1" />
            Analysis
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'datasets' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Your Datasets</h3>
                {user ? (
                  <Badge variant="outline" className="text-xs">
                    {datasets.length} datasets
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-orange-600">
                    Login required
                  </Badge>
                )}
              </div>

              {!user ? (
                <Card className="p-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Authentication Required</span>
                  </div>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Please log in to view and manage your datasets.
                  </p>
                </Card>
              ) : datasets.length === 0 ? (
                <Card className="p-4 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
                  <div className="text-center">
                    <Database className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      No datasets found. Upload your first dataset to get started.
                    </p>
                    <Button
                      onClick={() => setActiveTab('upload')}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      Upload Dataset
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {datasets.map((dataset) => (
                    <Card 
                      key={dataset.id} 
                      className={`p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        selectedDataset?.id === dataset.id ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : ''
                      }`}
                      onClick={() => {
                        setSelectedDataset(dataset);
                        // Load dataset data into analysis store if it has data
                        if (dataset.data && dataset.data.length > 0) {
                          setRawData(dataset.data);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-indigo-600" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {dataset.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {dataset.processingStatus && (
                            <Badge 
                              variant={dataset.processingStatus === 'completed' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {dataset.processingStatus}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {dataset.size}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{dataset.rows} rows • {dataset.columns} columns</span>
                        <span>{dataset.lastModified}</span>
                      </div>
                      {dataset.dataTypes && (
                        <div className="flex items-center gap-2 mt-2">
                          {dataset.dataTypes.numerical > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {dataset.dataTypes.numerical} numeric
                            </Badge>
                          )}
                          {dataset.dataTypes.categorical > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {dataset.dataTypes.categorical} categorical
                            </Badge>
                          )}
                          {dataset.dataTypes.temporal > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {dataset.dataTypes.temporal} temporal
                            </Badge>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

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

          {activeTab === 'data' && (rawData || selectedDataset) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Data Preview</h3>
                <div className="flex items-center gap-2">
                  {selectedDataset && (
                    <Badge variant="outline" className="text-xs">
                      {selectedDataset.name}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-500">
                    {(rawData || selectedDataset?.data || []).length} rows
                  </span>
                </div>
              </div>

              {/* Data Quality */}
              {dataProfile && rawData && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Data Quality</h4>
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      dataProfile.dataQuality === 'high' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' :
                      dataProfile.dataQuality === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                    }`}>
                      {dataProfile.dataQuality.toUpperCase()}
                    </div>
                    <span className="text-sm text-blue-700 dark:text-blue-300">Quality Score</span>
                  </div>
                </div>
              )}

              {/* Column Information */}
              {(() => {
                const currentData = rawData || selectedDataset?.data || [];
                const currentProfile = rawData ? dataProfile : null; // Only use dataProfile for current upload
                
                if (currentData.length === 0) {
                  return (
                    <Card className="p-4 bg-gray-50 dark:bg-gray-800/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                        No data available for preview
                      </p>
                    </Card>
                  );
                }

                return (
                  <>
                    <div className="space-y-2 mb-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Columns</h4>
                      {Object.keys(currentData[0] || {}).slice(0, 5).map((column, index) => {
                        const profile = currentProfile?.columns?.find((col: any) => col.name === column);
                        return (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{column}</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              profile?.type === 'numeric' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' :
                              profile?.type === 'categorical' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' :
                              profile?.type === 'temporal' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
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
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            {Object.keys(currentData[0] || {}).slice(0, 3).map((column, index) => (
                              <th key={index} className="px-2 py-1 text-left text-gray-600 dark:text-gray-400">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {currentData.slice(0, 5).map((row: any, index: number) => (
                            <tr key={index} className="border-t border-gray-100 dark:border-gray-700">
                              {Object.keys(currentData[0] || {}).slice(0, 3).map((column, colIndex) => (
                                <td key={colIndex} className="px-2 py-1 text-gray-700 dark:text-gray-300">
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
                  </>
                );
              })()}

              <div className="mt-4 space-y-2">
                <Button
                  onClick={() => handleAddToCanvas('dataset')}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  Add Dataset to Canvas
                </Button>
                {selectedDataset && selectedDataset.data && (
                  <Button
                    onClick={() => {
                      if (selectedDataset.data) {
                        startAnalysis(selectedDataset.data, selectedDataset.name);
                        setActiveTab('analysis');
                      }
                    }}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    Analyze Dataset
                  </Button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (rawData || selectedDataset) && (
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
                      <Button
                        onClick={() => {
                          const currentData = rawData || selectedDataset?.data;
                          const currentName = fileName || selectedDataset?.name || 'dataset';
                          if (currentData) {
                            startAnalysis(currentData, currentName);
                          }
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-sm"
                        disabled={!rawData && !selectedDataset?.data}
                      >
                        Start Analysis
                      </Button>
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