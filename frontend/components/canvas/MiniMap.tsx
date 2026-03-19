'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VisualizationPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MiniMapProps {
  visualizations: VisualizationPosition[];
  canvasSize: { width: number; height: number };
  viewportSize: { width: number; height: number };
  viewportPosition: { x: number; y: number; zoom?: number };
  onViewportChange: (position: { x: number; y: number }) => void;
  selectedId?: string;
}

export function MiniMap({
  visualizations,
  canvasSize,
  viewportSize,
  viewportPosition,
  onViewportChange,
  selectedId,
}: MiniMapProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const miniMapSize = { width: 200, height: 150 };
  
  // Canvas transform: translate(cW/2, cH/2) translate(vx, vy) scale(zoom)
  // World origin (0,0) is the content-div top-left = screen center at default viewport.
  // Minimap uses CENTER-ORIGIN: world (wx,wy) → minimap (centerX + wx*scaleX, centerY + wy*scaleY).
  // This keeps elements placed near world origin appearing near the minimap center.
  const scaleX = miniMapSize.width / canvasSize.width;
  const scaleY = miniMapSize.height / canvasSize.height;
  const centerX = miniMapSize.width / 2;
  const centerY = miniMapSize.height / 2;
  // Inner drawable area: container has 1px border on each side (box-sizing: border-box)
  const innerW = miniMapSize.width - 2;
  const innerH = miniMapSize.height - 2;

  const zoom = viewportPosition.zoom || 1;

  // Screen center maps to world (-vx/zoom, -vy/zoom).
  // That world point in minimap: (centerX - vx*scaleX/zoom, centerY - vy*scaleY/zoom).
  const vcX = centerX - viewportPosition.x * scaleX / zoom;
  const vcY = centerY - viewportPosition.y * scaleY / zoom;
  const rawW = viewportSize.width * scaleX / zoom;
  const rawH = viewportSize.height * scaleY / zoom;
  // Clamp left/right and top/bottom independently so all 4 borders remain visible
  const clampedLeft = Math.max(0, vcX - rawW / 2);
  const clampedTop = Math.max(0, vcY - rawH / 2);
  const clampedRight = Math.min(innerW, vcX + rawW / 2);
  const clampedBottom = Math.min(innerH, vcY + rawH / 2);
  const viewportRect = {
    x: clampedLeft,
    y: clampedTop,
    width: Math.max(0, clampedRight - clampedLeft),
    height: Math.max(0, clampedBottom - clampedTop),
  };

  const updateViewportFromMouse = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // world = (click - center) / scale; for world at screen center: vx = -world * zoom
    const canvasX = -(clickX - centerX) * zoom / scaleX;
    const canvasY = -(clickY - centerY) * zoom / scaleY;

    onViewportChange({ x: canvasX, y: canvasY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateViewportFromMouse(e);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      updateViewportFromMouse(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse up listener to handle drag end outside the component
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    
    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  return (
    <div className="w-full">
      <div className="bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-3 pb-2">
          <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">Canvas Overview</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isCollapsed ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </Button>
        </div>
        
        {!isCollapsed && (
          <div className="p-3 pt-1">
            <div className="flex justify-center">
              <div
                className={`relative border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 overflow-hidden select-none ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                style={{
                  width: miniMapSize.width,
                  height: miniMapSize.height
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
              {/* Grid pattern */}
              <div
                className="absolute inset-0 opacity-20 dark:opacity-40 canvas-grid"
                style={{
                  backgroundSize: `${20 * scaleX}px ${20 * scaleY}px`
                }}
              />
              
              {/* Visualizations — center-origin: world (wx,wy) → (centerX + wx*scaleX, centerY + wy*scaleY) */}
              {visualizations.map((viz) => {
                const elW = Math.max(viz.width * scaleX, 4);
                const elH = Math.max(viz.height * scaleY, 4);
                const elX = Math.max(0, Math.min(innerW - elW, centerX + viz.x * scaleX));
                const elY = Math.max(0, Math.min(innerH - elH, centerY + viz.y * scaleY));
                const isSelected = viz.id === selectedId;
                return (
                  <div
                    key={viz.id}
                    className={`absolute rounded-sm transition-all ${
                      isSelected
                        ? 'bg-blue-500 border-2 border-blue-300 opacity-100 shadow-[0_0_4px_2px_rgba(59,130,246,0.6)]'
                        : 'bg-indigo-500 border border-indigo-600 opacity-70 hover:opacity-90'
                    }`}
                    style={{ left: elX, top: elY, width: elW, height: elH }}
                    title="Visualization"
                  />
                );
              })}

        {/* Viewport indicator */}
        <div
          className="absolute bg-blue-200/20 cursor-move"
          style={{
            left: `${viewportRect.x}px`,
            top: `${viewportRect.y}px`,
            width: `${viewportRect.width}px`,
            height: `${viewportRect.height}px`,
            boxShadow: 'inset 0 0 0 2px #3b82f6',
          }}
        >
          {/* Click indicator */}
          <div className="absolute inset-0 hover:bg-blue-500/5 transition-colors" />
        </div>
              </div>
            </div>
            
            {/* Statistics */}
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Visualizations:</span>
                <span className="font-medium">{visualizations.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Canvas:</span>
                <span className="font-medium">{Math.round(canvasSize.width)} × {Math.round(canvasSize.height)}</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              <p>Click or drag to navigate</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
