'use client';

import React from 'react';
import {
  MousePointer2,
  Hand,
  Database,
  Table,
  BarChart3,
  Map,
  Type,
  Upload,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react';
import { useCanvasStore, ToolType } from '@/store/useCanvasStore';

interface ToolButtonProps {
  tool?: ToolType;
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  isSelected?: boolean;
  isToggle?: boolean;
}

function ToolButton({ tool, icon: Icon, label, shortcut, onClick, isSelected: customSelected, isToggle }: ToolButtonProps) {
  const { selectedTool, setSelectedTool } = useCanvasStore();
  const isSelected = customSelected !== undefined ? customSelected : selectedTool === tool;

  const handleClick = () => {
    if (tool && !isToggle) {
      setSelectedTool(tool);
    }
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      className={`
        flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200
        ${isSelected
          ? 'bg-blue-500 text-white shadow-lg'
          : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 border border-gray-200'
        }
      `}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      <Icon className="h-5 w-5 mb-1" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export default function BottomToolbar() {
  const { resetViewport, isDatasetPanelOpen, toggleDatasetPanel, viewport, updateViewport } = useCanvasStore();

  const handleDatasetToggle = () => {
    toggleDatasetPanel();
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(5, viewport.zoom * 1.2);
    updateViewport({ ...viewport, zoom: newZoom });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, viewport.zoom * 0.8);
    updateViewport({ ...viewport, zoom: newZoom });
  };

  const handleFitToScreen = () => {
    updateViewport({ x: 0, y: 0, zoom: 1 });
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-2">
        <div className="flex items-center gap-2">
          {/* Primary Tools */}
          <ToolButton
            tool="pointer"
            icon={MousePointer2}
            label="Select"
            shortcut="V"
          />
          <ToolButton
            tool="drag"
            icon={Hand}
            label="Pan"
            shortcut="H"
          />

          {/* Divider */}
          <div className="w-px h-8 bg-gray-300 mx-2" />

          {/* Content Tools */}
          <ToolButton
            icon={Database}
            label="Dataset"
            shortcut="D"
            onClick={handleDatasetToggle}
            isSelected={isDatasetPanelOpen}
            isToggle={true}
          />
          <ToolButton
            tool="table"
            icon={Table}
            label="Table"
            shortcut="T"
          />
          <ToolButton
            tool="chart"
            icon={BarChart3}
            label="Chart"
            shortcut="C"
          />
          <ToolButton
            tool="map"
            icon={Map}
            label="Map"
            shortcut="M"
          />
          <ToolButton
            tool="text"
            icon={Type}
            label="Text"
            shortcut="Shift+T"
          />

          {/* Divider */}
          <div className="w-px h-8 bg-gray-300 mx-2" />

          {/* Zoom Controls */}
          <button
            onClick={handleZoomOut}
            className="flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 border border-gray-200"
            title="Zoom Out (Ctrl+-)"
          >
            <ZoomOut className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Zoom-</span>
          </button>

          <div className="flex flex-col items-center justify-center p-2 bg-white text-gray-600 border border-gray-200 rounded-lg">
            <span className="text-xs font-medium">{Math.round(viewport.zoom * 100)}%</span>
          </div>

          <button
            onClick={handleZoomIn}
            className="flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 border border-gray-200"
            title="Zoom In (Ctrl++)"
          >
            <ZoomIn className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Zoom+</span>
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-300 mx-2" />

          {/* Utility Actions */}
          <button
            onClick={handleFitToScreen}
            className="flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 border border-gray-200"
            title="Fit to Screen (Ctrl+0)"
          >
            <Maximize className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Fit</span>
          </button>
          <button
            onClick={resetViewport}
            className="flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 border border-gray-200"
            title="Reset View (Space)"
          >
            <RotateCcw className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}