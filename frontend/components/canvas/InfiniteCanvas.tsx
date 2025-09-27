'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';

function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
  let inThrottle: boolean;
  return ((...args: any[]) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
}

function useRafThrottle<T extends (...args: any[]) => void>(func: T): T {
  const rafId = useRef<number | undefined>(undefined);
  const lastArgs = useRef<any[]>([]);

  const throttledFunc = useCallback((...args: any[]) => {
    lastArgs.current = args;
    if (rafId.current) return;

    rafId.current = requestAnimationFrame(() => {
      if (lastArgs.current) {
        func(...lastArgs.current);
      }
      rafId.current = undefined;
    });
  }, [func]);

  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return throttledFunc as T;
}

interface InfiniteCanvasProps {
  children: React.ReactNode;
}

export default function InfiniteCanvas({ children }: InfiniteCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const accumulatedDelta = useRef({ x: 0, y: 0 });
  const [localViewport, setLocalViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const {
    viewport,
    updateViewport,
    selectedTool,
    canvasElements
  } = useCanvasStore();

  // Sync local viewport with store viewport
  useEffect(() => {
    setLocalViewport(viewport);
  }, [viewport]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (selectedTool === 'drag' || e.button === 1) { // Middle mouse button or drag tool
      e.preventDefault();
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }
    } else if (selectedTool === 'pointer' && e.target === e.currentTarget) {
      // Clear selection when clicking on empty canvas
      const { clearSelection } = useCanvasStore.getState();
      clearSelection();
    }
  }, [selectedTool]);

  // Optimized viewport update with RAF throttling
  const throttledViewportUpdate = useRafThrottle(useCallback((newViewport: typeof viewport) => {
    updateViewport(newViewport);
  }, [updateViewport]));

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current) {
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;

      // Update local viewport immediately for smooth visual feedback
      const newViewport = {
        x: localViewport.x + deltaX,
        y: localViewport.y + deltaY,
        zoom: localViewport.zoom
      };

      setLocalViewport(newViewport);
      throttledViewportUpdate(newViewport);

      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, [localViewport, throttledViewportUpdate]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = selectedTool === 'drag' ? 'grab' : 'default';
    }
  }, [selectedTool]);

  // Throttled wheel handling for smooth zoom
  const throttledWheelUpdate = useRafThrottle(useCallback((newViewport: typeof viewport) => {
    setLocalViewport(newViewport);
    updateViewport(newViewport);
  }, [updateViewport]));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Use local viewport for immediate calculations
    const currentViewport = localViewport;

    // Convert mouse position to world coordinates
    const worldX = (mouseX - currentViewport.x) / currentViewport.zoom;
    const worldY = (mouseY - currentViewport.y) / currentViewport.zoom;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, currentViewport.zoom * zoomFactor));

    // Calculate new viewport position to zoom towards mouse
    const newX = mouseX - worldX * newZoom;
    const newY = mouseY - worldY * newZoom;

    throttledWheelUpdate({
      x: newX,
      y: newY,
      zoom: newZoom
    });
  }, [localViewport, throttledWheelUpdate]);

  // Set cursor based on selected tool
  useEffect(() => {
    if (canvasRef.current) {
      switch (selectedTool) {
        case 'pointer':
          canvasRef.current.style.cursor = 'default';
          break;
        case 'drag':
          canvasRef.current.style.cursor = 'grab';
          break;
        default:
          canvasRef.current.style.cursor = 'crosshair';
      }
    }
  }, [selectedTool]);

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-hidden bg-gray-50 canvas-optimized"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        cursor: selectedTool === 'drag' ? 'grab' : 'default',
        touchAction: 'none',
        userSelect: 'none',
        contain: 'layout style paint'
      }}
    >
      {/* Grid Background */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: `${20 * localViewport.zoom}px ${20 * localViewport.zoom}px`,
          backgroundPosition: `${localViewport.x}px ${localViewport.y}px`,
          willChange: 'background-position, background-size',
          contain: 'strict',
        }}
      />

      {/* Canvas Content */}
      <div
        className="absolute canvas-optimized"
        style={{
          transform: `translate(${localViewport.x}px, ${localViewport.y}px) scale(${localViewport.zoom})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        {children}
      </div>

      {/* Viewport Info (Debug) */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
        Zoom: {(localViewport.zoom * 100).toFixed(0)}% | X: {Math.round(localViewport.x)} | Y: {Math.round(localViewport.y)}
      </div>
    </div>
  );
}