'use client';

import { useState } from 'react';
import DropZone from './DropZone';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { CheckCircle, AlertCircle, FileText, Database, BarChart3 } from 'lucide-react';
import { FileParser } from '@/lib/utils/fileParser';

interface UploadSectionProps {
  onSuccess?: () => void;
}

export default function UploadSection({ onSuccess }: UploadSectionProps = {}) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [dataInfo, setDataInfo] = useState<{ columns: string[]; rowCount: number; dataTypes: Record<string, string> } | null>(null);
  const { setRawData, startAnalysis } = useAnalysisStore();

  const handleFileUpload = async (file: File) => {
    setUploadStatus('uploading');
    setFileName(file.name);
    setError('');
    setDataInfo(null);

    try {
      // Parse the file using our comprehensive parser
      const result = await FileParser.parseFile(file);

      if (result.error || result.data.length === 0) {
        setError(result.error || 'No data found in the file');
        setUploadStatus('error');
        return;
      }

      // Validate data size
      const sizeError = FileParser.validateDataSize(result.data);
      if (sizeError) {
        setError(sizeError);
        setUploadStatus('error');
        return;
      }

      // Analyze data structure
      const analysis = FileParser.analyzeDataStructure(result.data);
      setDataInfo(analysis);

      // Store the parsed data
      setRawData(result.data);
      setUploadStatus('success');

      // Call onSuccess callback to close modal
      if (onSuccess) {
        onSuccess();
      }

      // Automatically start analysis
      try {
        await startAnalysis(result.data, file.name);
      } catch (analysisError) {
        console.warn('Analysis failed to start automatically:', analysisError);
        // Don't change upload status - file was parsed successfully
      }
    } catch (err) {
      setError(`Unexpected error occurred while processing the file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setUploadStatus('error');
    }
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setFileName('');
    setError('');
    setDataInfo(null);
    setRawData(null);
  };

  if (uploadStatus === 'success') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">File Uploaded Successfully</h3>
            <p className="text-sm text-gray-600">Analysis started automatically</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">{fileName}</span>
          </div>

          {dataInfo && (
            <>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {dataInfo.rowCount.toLocaleString()} rows, {dataInfo.columns.length} columns
                </span>
              </div>

              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Data types: {Object.entries(
                    Object.entries(dataInfo.dataTypes).reduce((acc, [, type]) => {
                      acc[type] = (acc[type] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([type, count]) => `${count} ${type}`).join(', ')}
                </span>
              </div>

              <div className="text-xs text-gray-500">
                <details className="cursor-pointer">
                  <summary className="hover:text-gray-700">View column details</summary>
                  <div className="mt-2 ml-4 space-y-1">
                    {dataInfo.columns.map(column => (
                      <div key={column} className="flex justify-between">
                        <span>{column}</span>
                        <span className="text-gray-400">{dataInfo.dataTypes[column]}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </>
          )}
        </div>

        <button
          onClick={resetUpload}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          Upload different file
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Upload Your Dataset
        </h2>
        <p className="text-gray-600">
          Upload a CSV file to get started with automatic chart recommendations
        </p>
      </div>

      <DropZone onFileUpload={handleFileUpload} />

      {uploadStatus === 'uploading' && (
        <div className="mt-4 flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="text-sm text-gray-600">Processing {fileName}...</span>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Upload Failed</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}