/**
 * Export Button Component
 * Provides chart export functionality with multiple format options
 */

'use client';

import React, { useState } from 'react';
import { Download, FileImage, FileText, Image } from 'lucide-react';
import { ChartExportService, ExportFormat } from '@/lib/services/chartExport';

interface ExportButtonProps {
  elementRef: React.RefObject<HTMLElement | HTMLDivElement | null>;
  chartType?: string;
  filename?: string;
  className?: string;
}

export default function ExportButton({
  elementRef,
  chartType = 'chart',
  filename,
  className = ''
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    if (!elementRef.current) {
      console.error('No element to export');
      return;
    }

    if (!ChartExportService.canExport(elementRef.current)) {
      console.error('Element cannot be exported');
      return;
    }

    setIsExporting(true);
    setShowOptions(false);

    try {
      const exportFilename = filename || `${chartType}_chart_${new Date().toISOString().split('T')[0]}`;

      await ChartExportService.exportChart(elementRef.current, format, {
        filename: exportFilename,
        quality: 1.0,
        backgroundColor: '#ffffff'
      });

      console.log(`Chart exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      // You could add a toast notification here
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions = [
    {
      format: 'png' as ExportFormat,
      label: 'PNG Image',
      icon: Image,
      description: 'High-quality raster image'
    },
    {
      format: 'svg' as ExportFormat,
      label: 'SVG Vector',
      icon: FileImage,
      description: 'Scalable vector graphics'
    },
    {
      format: 'pdf' as ExportFormat,
      label: 'PDF Document',
      icon: FileText,
      description: 'Portable document format'
    }
  ];

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={isExporting}
        className={`
          flex items-center gap-2 px-3 py-2 text-sm font-medium
          bg-blue-600 text-white rounded-lg hover:bg-blue-700
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200
        `}
        title="Export chart"
      >
        <Download className="h-4 w-4" />
        {isExporting ? 'Exporting...' : 'Export'}
      </button>

      {showOptions && !isExporting && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => setShowOptions(false)}
          />

          {/* Export options dropdown */}
          <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-[10000]">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 mb-2 px-2">
                Export Options
              </div>
              {exportOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <button
                    key={option.format}
                    onClick={() => handleExport(option.format)}
                    className="w-full flex items-start gap-3 p-2 text-left hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <IconComponent className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {option.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}