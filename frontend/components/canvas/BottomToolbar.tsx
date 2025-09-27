'use client';

import React from 'react';
import {
  MousePointer2,
  Hand,
  BarChart3,
  Type,
  Maximize,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { useCanvasStore, ToolType } from '@/store/useCanvasStore';

interface ToolButtonProps {
  tool?: ToolType;
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  isSelected?: boolean;
  disabled?: boolean;
}

function ToolButton({ tool, icon: Icon, label, shortcut, onClick, isSelected: customSelected, disabled }: ToolButtonProps) {
  const { selectedTool, setSelectedTool } = useCanvasStore();
  const isSelected = customSelected !== undefined ? customSelected : selectedTool === tool;

  const handleClick = () => {
    if (disabled) return;
    if (tool) {
      setSelectedTool(tool);
    }
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 min-w-[60px]
        ${disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : isSelected
          ? 'bg-blue-500 text-white shadow-lg'
          : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 border border-gray-200 shadow-sm'
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
  const { resetViewport, viewport, updateViewport, canvasElements } = useCanvasStore();

  const handleZoomIn = () => {
    const newZoom = Math.min(5, viewport.zoom * 1.2);
    updateViewport({ ...viewport, zoom: newZoom });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, viewport.zoom * 0.8);
    updateViewport({ ...viewport, zoom: newZoom });
  };

  const handleFitToScreen = () => {
    if (canvasElements.length === 0) {
      // No elements, return to Cartesian origin (0, 0)
      updateViewport({ x: 0, y: 0, zoom: 0.8 });
      return;
    }

    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    canvasElements.forEach(element => {
      const left = element.position.x;
      const top = element.position.y;
      const right = element.position.x + element.size.width;
      const bottom = element.position.y + element.size.height;

      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });

    // Add padding around elements
    const padding = 100;
    const boundingWidth = maxX - minX + padding * 2;
    const boundingHeight = maxY - minY + padding * 2;

    // Calculate center of bounding box
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate zoom to fit elements in viewport
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth * 0.8 : 1600;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight * 0.8 : 1200;
    
    const zoomX = viewportWidth / boundingWidth;
    const zoomY = viewportHeight / boundingHeight;
    const fitZoom = Math.min(Math.min(zoomX, zoomY), 2); // Cap at 200%

    // Update viewport to center on elements with appropriate zoom
    updateViewport({ 
      x: centerX, 
      y: centerY, 
      zoom: Math.max(0.1, fitZoom) 
    });
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-2">
        <div className="flex items-center gap-2">
          {/* 1. Select Tool */}
          <ToolButton
            tool="pointer"
            icon={MousePointer2}
            label="Select"
            shortcut="V"
          />

          {/* 2. Pan Tool */}
          <ToolButton
            tool="drag"
            icon={Hand}
            label="Pan"
            shortcut="H"
          />

          {/* Divider */}
          <div className="w-px h-8 bg-gray-300 mx-2" />

          {/* 3. Chart Tool */}
          <ToolButton
            tool="chart"
            icon={BarChart3}
            label="Chart"
            shortcut="C"
          />

          {/* 4. Text Tool */}
          <ToolButton
            tool="text"
            icon={Type}
            label="Text"
            shortcut="T"
          />

          {/* Divider */}
          <div className="w-px h-8 bg-gray-300 mx-2" />

          {/* Zoom Controls */}
          <ToolButton
            icon={ZoomOut}
            label="Zoom-"
            shortcut="Ctrl+-"
            onClick={handleZoomOut}
          />

          <div className="flex flex-col items-center justify-center p-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg min-w-[60px]">
            <span className="text-xs font-medium">{Math.round(viewport.zoom * 100)}%</span>
          </div>

          <ToolButton
            icon={ZoomIn}
            label="Zoom+"
            shortcut="Ctrl++"
            onClick={handleZoomIn}
          />

          {/* Divider */}
          <div className="w-px h-8 bg-gray-300 mx-2" />

          {/* 5. Fit Tool */}
          <ToolButton
            icon={Maximize}
            label="Fit"
            shortcut="F"
            onClick={handleFitToScreen}
          />
        </div>
      </div>
    </div>
  );
}