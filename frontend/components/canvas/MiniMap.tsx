'use client';

import React, { useState } from 'react';
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
  viewportPosition: { x: number; y: number };
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
  const miniMapSize = { width: 200, height: 150 };
  
  // Calculate scale factors
  const scaleX = miniMapSize.width / canvasSize.width;
  const scaleY = miniMapSize.height / canvasSize.height;
  
  // Calculate viewport rectangle in minimap coordinates
  const viewportRect = {
    x: Math.max(0, viewportPosition.x * scaleX),
    y: Math.max(0, viewportPosition.y * scaleY),
    width: Math.min(miniMapSize.width, viewportSize.width * scaleX),
    height: Math.min(miniMapSize.height, viewportSize.height * scaleY)
  };

  const handleMiniMapClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert click position to canvas coordinates
    const canvasX = (clickX / scaleX) - (viewportSize.width / 2);
    const canvasY = (clickY / scaleY) - (viewportSize.height / 2);
    
    onViewportChange({ x: canvasX, y: canvasY });
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Card className="shadow-figma-lg glass-effect border-gray-200 dark:border-gray-700">
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
            <div
              className="relative cursor-pointer border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 overflow-hidden"
              style={{
                width: miniMapSize.width,
                height: miniMapSize.height
              }}
              onClick={handleMiniMapClick}
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
                    left: Math.max(0, viz.x * scaleX),
                    top: Math.max(0, viz.y * scaleY),
                    width: Math.max(viz.width * scaleX, 4),
                    height: Math.max(viz.height * scaleY, 4)
                  }}
                  title="Visualization"
                />
              ))}
              
              {/* Viewport indicator */}
              <div
                className="absolute border-2 border-blue-500 bg-blue-500/10 rounded pointer-events-none"
                style={{
                  left: Math.max(0, Math.min(viewportRect.x, miniMapSize.width - viewportRect.width)),
                  top: Math.max(0, Math.min(viewportRect.y, miniMapSize.height - viewportRect.height)),
                  width: Math.min(viewportRect.width, miniMapSize.width),
                  height: Math.min(viewportRect.height, miniMapSize.height)
                }}
              />

              {/* Click indicator */}
              <div className="absolute inset-0 hover:bg-blue-500/5 transition-colors" />
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
              <p>Click to navigate</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
