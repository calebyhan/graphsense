'use client';

import React, { useState } from 'react';
import {
  MousePointer,
  Hand,
  Type,
  Trash2,
  GripVertical,
  Database,
  BarChart3,
  ZoomIn,
  ZoomOut,
  Maximize,
  Crosshair,
  Table,
  Map
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCanvasStore, ToolType } from '@/store/useCanvasStore';

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
  { id: 'table' as ToolType, name: 'Table', icon: Table, shortcut: 'T' },
  { id: 'text' as ToolType, name: 'Text', icon: Type, shortcut: 'Shift+T' },
  { id: 'map' as ToolType, name: 'Map', icon: Map, shortcut: 'M' },
];

export default function FloatingToolbar({
  onAddVisualization: _onAddVisualization,
  onDeleteSelected,
  hasSelection = false
}: FloatingToolbarProps) {
  const { selectedTool, setSelectedTool, selectedElements, viewport, updateViewport, canvasElements, resetViewport } = useCanvasStore();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Initialize toolbar position at bottom center
  React.useEffect(() => {
    const updatePosition = () => {
      setPosition({
        x: window.innerWidth / 2 - 415, // 830px width / 2
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
      const newX = Math.max(0, Math.min(window.innerWidth - 830, e.clientX - dragStart.x));
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



  const handleDeleteSelected = () => {
    if (selectedElements.length > 0) {
      onDeleteSelected?.();
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(5, viewport.zoom + 0.1);
    updateViewport({ ...viewport, zoom: newZoom });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, viewport.zoom - 0.1);
    updateViewport({ ...viewport, zoom: newZoom });
  };

  const handleFitToScreen = () => {
    if (canvasElements.length === 0) {
      updateViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

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

    const padding = 50;
    const boundingWidth = maxX - minX + padding * 2;
    const boundingHeight = maxY - minY + padding * 2;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth - 400 : 1200;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight - 200 : 800;
    const zoomX = viewportWidth / boundingWidth;
    const zoomY = viewportHeight / boundingHeight;
    const fitZoom = Math.min(Math.min(zoomX, zoomY), 3);
    const targetZoom = Math.max(0.1, fitZoom);
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    const targetX = viewportCenterX - (centerX * targetZoom);
    const targetY = viewportCenterY - (centerY * targetZoom);
    updateViewport({ x: targetX, y: targetY, zoom: targetZoom });
  };

  return (
    <div
      className="fixed z-50 animate-fade-in"
      style={{
        left: position.x,
        top: position.y,
        width: '830px'
      }}
      onMouseDown={handleMouseDown}
    >
      <Card className="glass-effect shadow-figma-xl border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 p-3">
          {/* Drag Handle */}
          <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center justify-center w-8 h-8 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>

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

          {/* Separator */}
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              className="h-10 w-10 p-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
              title="Zoom Out (Ctrl+-)"
            >
              <ZoomOut className="w-5 h-5" />
            </Button>
            
            <div className="px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded text-xs font-medium text-gray-600 dark:text-gray-400 min-w-[50px] text-center">
              {Math.round(viewport.zoom * 100)}%
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              className="h-10 w-10 p-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
              title="Zoom In (Ctrl++)"
            >
              <ZoomIn className="w-5 h-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFitToScreen}
              className="h-10 w-10 p-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
              title="Fit to Screen (Ctrl+0 / F)"
            >
              <Maximize className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetViewport}
              className="h-10 w-10 p-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
              title="Go to Origin (Space)"
            >
              <Crosshair className="w-5 h-5" />
            </Button>
          </div>

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

