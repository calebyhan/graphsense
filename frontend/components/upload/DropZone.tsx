'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface DropZoneProps {
  onFileUpload: (file: File) => void;
}

export default function DropZone({ onFileUpload }: DropZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/tab-separated-values': ['.tsv'],
      'text/plain': ['.tsv', '.txt']
    },
    maxSize: 104857600, // 100MB as per requirements
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
        transition-colors duration-200
        ${isDragActive && !isDragReject
          ? 'border-blue-500 bg-blue-50'
          : isDragReject
          ? 'border-red-500 bg-red-50'
          : 'border-gray-300 hover:border-gray-400'
        }
      `}
    >
      <input {...getInputProps()} />
      <Upload className={`mx-auto h-12 w-12 ${isDragReject ? 'text-red-400' : 'text-gray-400'}`} />
      <p className="mt-4 text-lg font-medium">
        {isDragActive
          ? isDragReject
            ? 'File type not supported'
            : 'Drop your file here'
          : 'Drag & drop your dataset file here'
        }
      </p>
      <p className="mt-2 text-sm text-gray-500">or click to select</p>
      <p className="mt-1 text-xs text-gray-400">
        Supported: CSV, JSON, Excel (.xlsx/.xls), TSV • Maximum size: 100MB
      </p>
    </div>
  );
}