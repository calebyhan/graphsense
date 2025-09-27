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
  const miniMapSize = { width: 240, height: 160 }; // Adjusted for sidebar
  
  // Calculate scale factors
  const scaleX = miniMapSize.width / canvasSize.width;
  const scaleY = miniMapSize.height / canvasSize.height;
  
  // Calculate viewport rectangle in minimap coordinates for Cartesian coordinate system
  // Canvas ranges: X(-3000 to +3000), Y(-2000 to +2000)
  const viewportRect = {
    x: (viewportPosition.x + 3000) * scaleX - (viewportSize.width * scaleX) / 2,
    y: (-viewportPosition.y + 2000) * scaleY - (viewportSize.height * scaleY) / 2,
    width: viewportSize.width * scaleX,
    height: viewportSize.height * scaleY
  };


  const handleMiniMapClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert click position to Cartesian coordinates
    // MiniMap X: 0 to miniMapSize.width -> Canvas X: -3000 to +3000
    // MiniMap Y: 0 to miniMapSize.height -> Canvas Y: +2000 to -2000 (flipped)
    const cartesianX = (clickX / scaleX) - 3000;
    const cartesianY = 2000 - (clickY / scaleY); // Flip Y for Cartesian

    onViewportChange({ x: cartesianX, y: cartesianY });
  };

  return (
    <div className="w-full">
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
              {/* Grid pattern for Cartesian coordinate system */}
              <div
                className="absolute inset-0 opacity-20 dark:opacity-40 canvas-grid"
                style={{
                  backgroundSize: `${20 * scaleX}px ${20 * scaleY}px`,
                  backgroundPosition: `${3000 * scaleX % (20 * scaleX)}px ${2000 * scaleY % (20 * scaleY)}px`
                }}
              />
              
              {/* Coordinate axes indicators */}
              <div className="absolute inset-0 pointer-events-none">
                {/* X-axis (Y=0) */}
                <div 
                  className="absolute w-full border-t border-gray-400 dark:border-gray-500 opacity-30"
                  style={{
                    top: `${2000 * scaleY}px`,
                  }}
                />
                {/* Y-axis (X=0) */}
                <div 
                  className="absolute h-full border-l border-gray-400 dark:border-gray-500 opacity-30"
                  style={{
                    left: `${3000 * scaleX}px`,
                  }}
                />
                {/* Origin indicator */}
                <div 
                  className="absolute w-2 h-2 bg-red-500 rounded-full transform -translate-x-1 -translate-y-1 opacity-60"
                  style={{
                    left: `${3000 * scaleX}px`,
                    top: `${2000 * scaleY}px`,
                  }}
                />
              </div>
              
              {/* Visualizations */}
              {visualizations.map((viz) => (
                <div
                  key={viz.id}
                  className="absolute bg-indigo-500 rounded-sm opacity-70 border border-indigo-600 hover:opacity-90 transition-opacity"
                  style={{
                    left: Math.max(0, (viz.x + 3000) * scaleX),
                    top: Math.max(0, (-viz.y + 2000) * scaleY), // Flip Y for Cartesian
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
