'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
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
}

export function MiniMap({
  visualizations,
  canvasSize,
  viewportSize,
  viewportPosition,
  onViewportChange
}: MiniMapProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const miniMapSize = { width: 200, height: 150 };
  
  // Calculate scale factors
  const scaleX = miniMapSize.width / canvasSize.width;
  const scaleY = miniMapSize.height / canvasSize.height;
  
  // Calculate viewport rectangle in minimap coordinates (Cartesian system)
  const miniMapCenterX = miniMapSize.width / 2;
  const miniMapCenterY = miniMapSize.height / 2;
  
  // Extract zoom from viewportPosition, default to 1
  const zoom = viewportPosition.zoom || 1;
  
  const viewportRect = {
    x: Math.max(0, Math.min(miniMapSize.width - (viewportSize.width * scaleX / zoom), 
        miniMapCenterX + (viewportPosition.x * scaleX) - (viewportSize.width * scaleX / zoom) / 2)),
    y: Math.max(0, Math.min(miniMapSize.height - (viewportSize.height * scaleY / zoom), 
        miniMapCenterY + (viewportPosition.y * scaleY) - (viewportSize.height * scaleY / zoom) / 2)), // Canvas Y is inverted in transform
    width: Math.min(miniMapSize.width, viewportSize.width * scaleX / zoom),
    height: Math.min(miniMapSize.height, viewportSize.height * scaleY / zoom)
  };

  const updateViewportFromMouse = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert click position to canvas coordinates
    // In minimap: center is at (miniMapCenterX, miniMapCenterY)
    // Canvas transform: translate(centerX, centerY) translate(viewport.x, -viewport.y)
    // So viewport coordinates are: viewport.x = world.x, viewport.y = -world.y
    const canvasX = (clickX - miniMapCenterX) / scaleX; // Direct mapping
    const canvasY = (clickY - miniMapCenterY) / scaleY; // Direct mapping
    
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
              
              {/* Visualizations */}
              {visualizations.map((viz) => (
                <div
                  key={viz.id}
                  className="absolute bg-indigo-500 rounded-sm opacity-70 border border-indigo-600 hover:opacity-90 transition-opacity"
                  style={{
                    left: Math.max(0, Math.min(miniMapSize.width - Math.max(viz.width * scaleX, 4), 
                          miniMapCenterX + (viz.x * scaleX))),
                    top: Math.max(0, Math.min(miniMapSize.height - Math.max(viz.height * scaleY, 4), 
                          miniMapCenterY + (viz.y * scaleY))), // Direct mapping to match canvas positions
                    width: Math.max(viz.width * scaleX, 4),
                    height: Math.max(viz.height * scaleY, 4)
                  }}
                  title="Visualization"
                />
              ))}
              
        {/* Viewport indicator */}
        <div
          className="absolute border-2 border-blue-500 bg-blue-200/20 cursor-move"
          style={{
            left: `${viewportRect.x}px`,
            top: `${viewportRect.y}px`,
            width: `${viewportRect.width}px`,
            height: `${viewportRect.height}px`
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
                <span className="font-medium">{canvasSize.width} × {canvasSize.height}</span>
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
