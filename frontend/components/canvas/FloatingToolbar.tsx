'use client';

import React, { useState, useRef } from 'react';
import { 
  Plus, 
  MousePointer, 
  Hand, 
  Square, 
  Circle, 
  Type, 
  Image, 
  Trash2, 
  GripVertical,
  Database,
  BarChart3,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCanvasStore, ToolType } from '@/store/useCanvasStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';

interface FloatingToolbarProps {
  onAddVisualization?: () => void;
  onDeleteSelected?: () => void;
  hasSelection?: boolean;
}

const tools = [
  { id: 'pointer' as ToolType, name: 'Select', icon: MousePointer, shortcut: 'V' },
  { id: 'drag' as ToolType, name: 'Hand', icon: Hand, shortcut: 'H' },
  { id: 'chart' as ToolType, name: 'Chart', icon: BarChart3, shortcut: 'C' },
  { id: 'dataset' as ToolType, name: 'Dataset', icon: Database, shortcut: 'D' },
  { id: 'text' as ToolType, name: 'Text', icon: Type, shortcut: 'T' },
];

export default function FloatingToolbar({
  onAddVisualization,
  onDeleteSelected,
  hasSelection = false
}: FloatingToolbarProps) {
  const { selectedTool, setSelectedTool, selectedElements, isDatasetPanelOpen, toggleDatasetPanel, viewport, updateViewport, canvasElements } = useCanvasStore();
  const { recommendations } = useAnalysisStore();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Initialize toolbar position at bottom center
  React.useEffect(() => {
    const updatePosition = () => {
      setPosition({
        x: window.innerWidth / 2 - 375, // 750px width / 2
        y: window.innerHeight - 100
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - 750, e.clientX - dragStart.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 80, e.clientY - dragStart.y));
      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleToolSelect = (tool: ToolType) => {
    setSelectedTool(tool);
  };

  const handleAddVisualization = () => {
    if (recommendations && recommendations.length > 0) {
      onAddVisualization?.();
    } else {
      // Open dataset panel if no recommendations
      if (!isDatasetPanelOpen) {
        toggleDatasetPanel();
      }
    }
  };

  const handleDeleteSelected = () => {
    if (selectedElements.length > 0) {
      onDeleteSelected?.();
    }
  };

  // Zoom functions
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
    <div
      className="fixed z-50 animate-fade-in"
      style={{
        left: position.x,
        top: position.y,
        width: '750px'
      }}
      onMouseDown={handleMouseDown}
    >
      <Card className="glass-effect shadow-figma-xl border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 p-3">
          {/* Drag Handle */}
          <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center justify-center w-8 h-8 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>

          {/* Quick Add Visualization */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddVisualization}
            className={cn(
              "h-10 w-10 p-0 rounded-lg transition-all duration-200",
              recommendations && recommendations.length > 0
                ? "text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900"
                : "text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            )}
            title="Add Visualization"
          >
            <Plus className="w-5 h-5" />
          </Button>

          {/* Separator */}
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />

          {/* Tools */}
          <div className="flex items-center gap-1">
            {tools.map((tool) => (
              <Button
                key={tool.id}
                variant={selectedTool === tool.id ? "default" : "ghost"}
                size="sm"
                onClick={() => handleToolSelect(tool.id)}
                className={cn(
                  "h-10 w-10 p-0 rounded-lg transition-all duration-200",
                  selectedTool === tool.id
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
                title={`${tool.name} (${tool.shortcut})`}
              >
                <tool.icon className="w-5 h-5" />
              </Button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />
          
          {/* Zoom Out */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            className="h-10 w-10 p-0 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Zoom Out (Ctrl + -)"
          >
            <ZoomOut className="w-5 h-5" />
          </Button>

          {/* Zoom Level Display */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg min-w-[60px] text-center">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {Math.round(viewport.zoom * 100)}%
            </span>
          </div>

          {/* Zoom In */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            className="h-10 w-10 p-0 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Zoom In (Ctrl + +)"
          >
            <ZoomIn className="w-5 h-5" />
          </Button>

          {/* Fit to Screen */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFitToScreen}
            className="h-10 w-10 p-0 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Fit to Screen (F)"
          >
            <Maximize className="w-5 h-5" />
          </Button>

          {/* Delete Selected */}
          {(hasSelection || selectedElements.length > 0) && (
            <>
              <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteSelected}
                className="h-10 w-10 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-all duration-200"
                title="Delete Selected (Del)"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

