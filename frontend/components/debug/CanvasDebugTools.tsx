'use client';

import React, { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';

/**
 * Debug component to test canvas positioning and coordinate transformations
 * Add this temporarily to test positioning fixes
 */
export function CanvasDebugTools() {
  const { viewport, addElement, canvasElements } = useCanvasStore();
  const [debugInfo, setDebugInfo] = useState<string>('');

  const addTestChart = () => {
    const viewportCenter = useCanvasStore.getState().getViewportCenterPosition();
    
    const testElement = {
      type: 'chart' as const,
      position: viewportCenter,
      size: { width: 300, height: 200 },
      data: {
        config: {
          title: `Test Chart ${Date.now()}`,
          data: [
            { x: 1, y: 10 },
            { x: 2, y: 20 },
            { x: 3, y: 15 }
          ],
          xAxis: 'x',
          yAxis: 'y'
        },
        chartType: 'bar',
        title: `Test Chart ${Date.now()}`
      }
    };

    const debugInfo = {
      viewport,
      viewportCenter,
      canvasElementsCount: canvasElements.length,
      timestamp: new Date().toISOString()
    };

    setDebugInfo(JSON.stringify(debugInfo, null, 2));
    console.log('🧪 Debug: Adding test chart', debugInfo);
    
    addElement(testElement);
  };

  const clearCanvas = () => {
    // Clear all elements by removing them one by one
    canvasElements.forEach(element => {
      useCanvasStore.getState().removeElement(element.id);
    });
    setDebugInfo('Canvas cleared');
  };

  return (
    <div className="fixed top-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border z-50 max-w-sm">
      <h3 className="text-sm font-semibold mb-3">Canvas Debug Tools</h3>
      
      <div className="space-y-2 mb-3 text-xs">
        <div>Viewport: x={viewport.x.toFixed(1)}, y={viewport.y.toFixed(1)}, zoom={viewport.zoom.toFixed(2)}</div>
        <div>Elements: {canvasElements.length}</div>
      </div>

      <div className="space-y-2">
        <button
          onClick={addTestChart}
          className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Add Test Chart
        </button>
        
        <button
          onClick={clearCanvas}
          className="w-full px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Clear Canvas
        </button>
      </div>

      {debugInfo && (
        <details className="mt-3">
          <summary className="text-xs cursor-pointer">Debug Info</summary>
          <pre className="text-xs mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded overflow-auto max-h-32">
            {debugInfo}
          </pre>
        </details>
      )}
    </div>
  );
}

// To use this component, temporarily add it to your main canvas view:
// import { CanvasDebugTools } from './path/to/CanvasDebugTools';
// 
// Then in your JSX:
// {process.env.NODE_ENV === 'development' && <CanvasDebugTools />}