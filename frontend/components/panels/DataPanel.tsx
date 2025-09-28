'use client';

import React, { useState, useCallback } from 'react';
import { Upload, Database, Search, Filter, FileText, BarChart3, Calendar, MapPin, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dataset } from '@/components/AutoVizAgent';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { useDatasetManager } from '@/hooks/useDatasetManager';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { ProcessingStatus } from '@/lib/services/datasetService';

interface DataPanelProps {
  selectedDataset: Dataset | null;
  onDatasetSelect: (dataset: Dataset) => void;
}

export function DataPanel({ selectedDataset, onDatasetSelect }: DataPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedDataset, setDraggedDataset] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);

  // Use database-integrated dataset manager
  const {
    datasets,
    createDatasetWithLifecycle,
    isLoading: isDatasetsLoading,
    createWithLifecycleError,
    error: datasetError
  } = useDatasetManager({
    onDatasetCreated: (dataset) => {
      console.log('🎉 Dataset created and persisted to database:', dataset);
      onDatasetSelect(dataset);
      
      // Set raw data in analysis store to trigger visualization
      if (dataset.data && dataset.data.length > 0) {
        console.log('🔗 Setting raw data in analysis store:', dataset.data.length, 'rows');
        setRawData(dataset.data);
        startAnalysis(dataset.data, dataset.name);
      }
      
      setUploadError('');
      setUploadProgress(0);
      setProcessingStatus(null);
    }
  });

  const { setRawData, startAnalysis } = useAnalysisStore();
  const { isAuthenticated } = useAuthContext();

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 DataPanel Debug:', {
      datasetsLength: datasets.length,
      datasets: datasets.map(d => ({ id: d.id, name: d.name })),
      isDatasetsLoading,
      datasetError: datasetError?.message,
      isAuthenticated
    });
  }, [datasets, isDatasetsLoading, datasetError, isAuthenticated]);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadError('');
    setUploadProgress(0);
    setProcessingStatus('pending');

    const file = files[0];

    try {
      // Validate file size (100MB limit)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        setUploadError('File size exceeds 100MB limit');
        setProcessingStatus(null);
        return;
      }

      // Use the lifecycle-based dataset creation
      createDatasetWithLifecycle({
        file,
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
        onStatusChange: (status) => {
          setProcessingStatus(status);
          // Note: Dataset lifecycle handles data processing internally
          // No need to manually parse and set raw data here
        }
      });
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to process file');
      setProcessingStatus('failed');
    }
  }, [createDatasetWithLifecycle, setRawData, startAnalysis]);

  const { openFileDialog, fileInputProps } = useFileUpload({
    accept: '.csv,.json,.xlsx,.xls,.tsv,.txt',
    onFileSelect: handleFileSelect
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const filteredDatasets = (datasets || []).filter(dataset =>
    dataset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show processing status icon
  const getProcessingStatusIcon = (status?: ProcessingStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  // Get status color for progress bar
  const getStatusColor = (status?: ProcessingStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const handleDragStart = (e: React.DragEvent, dataset: Dataset) => {
    setDraggedDataset(dataset.id);
    e.dataTransfer.setData('text/plain', dataset.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggedDataset(null);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'csv': return <FileText className="w-4 h-4" />;
      case 'json': return <Database className="w-4 h-4" />;
      case 'excel': return <BarChart3 className="w-4 h-4" />;
      case 'api': return <Database className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'numerical': return <BarChart3 className="w-3 h-3" />;
      case 'categorical': return <Filter className="w-3 h-3" />;
      case 'temporal': return <Calendar className="w-3 h-3" />;
      case 'geographic': return <MapPin className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
  };

  return (
    <div className="w-80 h-full glass-effect border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-figma-lg">
      {/* Hidden file input */}
      <input {...fileInputProps} />

      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Data Sources</h2>

        {/* Import Zone */}
        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer"
          onClick={openFileDialog}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Drop files here or click to upload</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">CSV, JSON, Excel (max 100MB)</p>
        </div>

        {/* Upload Status */}
        {(uploadError || createWithLifecycleError || processingStatus) && (
          <div className="mt-3 space-y-2">
            {/* Error Display */}
            {(uploadError || createWithLifecycleError) && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-xs text-red-600 dark:text-red-400">
                  {uploadError || createWithLifecycleError?.message}
                </p>
              </div>
            )}

            {/* Processing Status */}
            {processingStatus && !uploadError && !createWithLifecycleError && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  {getProcessingStatusIcon(processingStatus)}
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {processingStatus === 'pending' && 'Preparing upload...'}
                    {processingStatus === 'processing' && 'Processing file...'}
                    {processingStatus === 'completed' && 'Upload completed!'}
                    {processingStatus === 'failed' && 'Upload failed'}
                  </p>
                </div>

                {/* Progress Bar */}
                {(processingStatus === 'processing' || processingStatus === 'pending') && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${getStatusColor(processingStatus)}`}
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}


      </div>

      {/* Search and Filter */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search datasets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Dataset Library */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Loading State */}
        {isDatasetsLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            <span className="ml-2 text-sm text-gray-500">Loading datasets...</span>
          </div>
        )}

        {/* Database Error */}
        {datasetError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-4">
            <p className="text-xs text-red-600 dark:text-red-400">
              Failed to load datasets: {datasetError.message}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filteredDatasets.map((dataset) => (
            <Card
              key={dataset.id}
              className={`p-3 cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedDataset?.id === dataset.id 
                  ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' 
                  : 'hover:border-indigo-300 dark:hover:border-indigo-600'
              } ${
                draggedDataset === dataset.id ? 'opacity-50 scale-95' : ''
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, dataset)}
              onDragEnd={handleDragEnd}
              onClick={() => onDatasetSelect(dataset)}
            >
              {/* Dataset Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                    {getTypeIcon(dataset.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {dataset.name}
                      </h4>
                      {dataset.processingStatus && getProcessingStatusIcon(dataset.processingStatus)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {dataset.columns} cols • {dataset.rows.toLocaleString()} rows • {dataset.size}
                    </p>
                  </div>
                </div>
                {selectedDataset?.id === dataset.id && (
                  <div className="flex-shrink-0 w-2 h-2 bg-indigo-500 rounded-full"></div>
                )}
              </div>

              {/* Data Type Indicators */}
              <div className="flex flex-wrap gap-1 mb-2">
                {Object.entries(dataset.dataTypes).map(([type, count]) => 
                  count > 0 && (
                    <Badge key={type} variant="secondary" className="text-xs flex items-center gap-1">
                      {getDataTypeIcon(type)}
                      {count}
                    </Badge>
                  )
                )}
              </div>

              {/* Preview */}
              <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                <div className="flex flex-wrap gap-1">
                  {dataset.preview.slice(0, 3).map((col, idx) => (
                    <span key={idx} className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                      {col}
                    </span>
                  ))}
                  {dataset.preview.length > 3 && (
                    <span className="text-gray-400 dark:text-gray-500">+{dataset.preview.length - 3} more</span>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 dark:text-gray-500">Updated {dataset.lastModified}</p>
                {selectedDataset?.id === dataset.id && (
                  <Badge variant="default" className="text-xs">
                    Selected
                  </Badge>
                )}
              </div>

              {/* Drag indicator */}
              {draggedDataset === dataset.id && (
                <div className="absolute inset-0 border-2 border-dashed border-indigo-400 rounded-lg bg-indigo-50/20 dark:bg-indigo-900/20 flex items-center justify-center">
                  <span className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    Drag to canvas
                  </span>
                </div>
              )}
            </Card>
          ))}
        </div>

        {filteredDatasets.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No datasets found</p>
            <p className="text-xs">Try adjusting your search or upload new data</p>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30">
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p><strong>Tip:</strong> Drag datasets onto the canvas to create visualizations</p>
          <p><strong>Click</strong> a dataset to see AI recommendations</p>
        </div>
      </div>
    </div>
  );
}
