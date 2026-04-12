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
  Table,
  Map,
  StickyNote,
  ZoomIn,
  ZoomOut,
  Maximize,
  Crosshair,
  Download,
  FileImage,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCanvasStore, ToolType } from '@/store/useCanvasStore';

interface FloatingToolbarProps {
  onAddVisualization?: () => void;
  onDeleteSelected?: () => void;
  hasSelection?: boolean;
  onExportCanvas?: (format: 'png' | 'pdf') => void;
  isExporting?: boolean;
}

const tools = [
  { id: 'pointer' as ToolType, name: 'Select', icon: MousePointer, shortcut: 'V' },
  { id: 'drag' as ToolType, name: 'Hand', icon: Hand, shortcut: 'H' },
  { id: 'chart' as ToolType, name: 'Chart', icon: BarChart3, shortcut: 'C' },
  { id: 'dataset' as ToolType, name: 'Dataset', icon: Database, shortcut: 'D' },
  { id: 'table' as ToolType, name: 'Table', icon: Table, shortcut: 'T' },
  { id: 'text' as ToolType, name: 'Text', icon: Type, shortcut: 'Shift+T' },
  { id: 'map' as ToolType, name: 'Map', icon: Map, shortcut: 'M' },
  { id: 'note' as ToolType, name: 'Note', icon: StickyNote, shortcut: 'N' },
];

export default function FloatingToolbar({
  onAddVisualization: _onAddVisualization,
  onDeleteSelected,
  hasSelection = false,
  onExportCanvas,
  isExporting = false,
}: FloatingToolbarProps) {
  const { selectedTool, setSelectedTool, selectedElements, viewport, updateViewport, resetViewport } = useCanvasStore();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const toolbarRef = React.useRef<HTMLDivElement>(null);

  // Initialize toolbar position at bottom center
  React.useEffect(() => {
    const updatePosition = () => {
      const w = toolbarRef.current?.offsetWidth ?? 0;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - w, window.innerWidth / 2 - w / 2)),
        y: Math.max(0, Math.min(window.innerHeight - 80, window.innerHeight - 100)),
      });
    };

    // Small delay so the DOM has rendered and offsetWidth is available
    const id = setTimeout(updatePosition, 0);
    window.addEventListener('resize', updatePosition);
    return () => { clearTimeout(id); window.removeEventListener('resize', updatePosition); };
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
      const w = toolbarRef.current?.offsetWidth ?? 0;
      const newX = Math.max(0, Math.min(window.innerWidth - w, e.clientX - dragStart.x));
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
    const vp = useCanvasStore.getState().viewport;
    const newZoom = Math.min(5, vp.zoom + 0.1);
    // Scale pan proportionally to keep the world origin pinned at the same screen position
    const scale = newZoom / vp.zoom;
    updateViewport({ x: vp.x * scale, y: vp.y * scale, zoom: newZoom });
  };

  const handleZoomOut = () => {
    const vp = useCanvasStore.getState().viewport;
    const newZoom = Math.max(0.1, vp.zoom - 0.1);
    const scale = newZoom / vp.zoom;
    updateViewport({ x: vp.x * scale, y: vp.y * scale, zoom: newZoom });
  };

  const handleFitToScreen = () => useCanvasStore.getState().fitToScreen();

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 animate-fade-in"
      style={{
        left: position.x,
        top: position.y,
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

          {/* Export Canvas */}
          {onExportCanvas && (
            <>
              <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExportOptions(!showExportOptions)}
                  disabled={isExporting}
                  className="h-10 w-10 p-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                  title="Export Canvas"
                >
                  {isExporting ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                </Button>

                {showExportOptions && !isExporting && (
                  <>
                    <div
                      className="fixed inset-0 z-[9998] canvas-export-ignore"
                      onClick={() => setShowExportOptions(false)}
                    />
                    <div className="absolute bottom-full mb-2 right-0 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999] canvas-export-ignore">
                      <div className="p-2">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 px-2">
                          Export Canvas
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowExportOptions(false); onExportCanvas('png'); }}
                          className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                        >
                          <FileImage className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">PNG Image</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">High-quality raster</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowExportOptions(false); onExportCanvas('pdf'); }}
                          className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                        >
                          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">PDF Document</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Portable document</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

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

