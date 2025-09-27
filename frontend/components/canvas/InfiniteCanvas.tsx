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
  onCanvasClick?: (e: React.MouseEvent) => void;
}

export default function InfiniteCanvas({ children, onCanvasClick }: InfiniteCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const accumulatedDelta = useRef({ x: 0, y: 0 });
  const [localViewport, setLocalViewport] = useState({ x: 0, y: 0, zoom: 1 });
  
  // Touch gesture support
  const lastTouchDistance = useRef<number>(0);
  const lastTouchCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isTouchZooming = useRef(false);

  // Touchpad pinch-to-zoom support
  const initialGestureScale = useRef<number>(1);
  const isGesturing = useRef(false);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistance = useRef<number>(0);
  const [isZooming, setIsZooming] = useState(false);
  const zoomAnimationId = useRef<number | undefined>(undefined);

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
    
    // Call onCanvasClick if provided
    if (onCanvasClick && e.target === e.currentTarget) {
      onCanvasClick(e);
    }
  }, [selectedTool, onCanvasClick]);

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

  // Smooth zoom animation function
  const animateZoom = useCallback((targetZoom: number, centerPoint: { x: number; y: number } | null = null) => {
    if (zoomAnimationId.current) {
      cancelAnimationFrame(zoomAnimationId.current);
    }

    const startZoom = localViewport.zoom;
    const zoomDiff = targetZoom - startZoom;
    const duration = 150; // ms
    const startTime = Date.now();

    if (Math.abs(zoomDiff) < 0.001) return; // Skip if zoom difference is negligible

    setIsZooming(true);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic function for smooth animation
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentZoom = startZoom + (zoomDiff * eased);

      let newX = localViewport.x;
      let newY = localViewport.y;

      if (centerPoint) {
        // Zoom towards the specified point
        const worldX = (centerPoint.x - localViewport.x) / startZoom;
        const worldY = (centerPoint.y - localViewport.y) / startZoom;
        newX = centerPoint.x - worldX * currentZoom;
        newY = centerPoint.y - worldY * currentZoom;
      }

      const newViewport = { x: newX, y: newY, zoom: currentZoom };
      setLocalViewport(newViewport);
      updateViewport(newViewport);
      
      if (progress < 1) {
        zoomAnimationId.current = requestAnimationFrame(animate);
      } else {
        setIsZooming(false);
      }
    };
    
    zoomAnimationId.current = requestAnimationFrame(animate);
  }, [localViewport, updateViewport]);

  // Throttled wheel handling for smooth zoom
  const throttledWheelUpdate = useRafThrottle(useCallback((newViewport: typeof viewport) => {
    setLocalViewport(newViewport);
    updateViewport(newViewport);
  }, [updateViewport]));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Always prevent default to stop browser zoom
    e.preventDefault();
    e.stopPropagation();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const centerPoint = { x: mouseX, y: mouseY };

    let delta = 0;
    let isZoomGesture = false;

    // Comprehensive pinch gesture detection for all browsers/platforms
    
    // Method 1: Ctrl/Cmd + wheel (Windows/Linux touchpad pinch OR Ctrl+scroll)
    if (e.ctrlKey || e.metaKey) {
      const zoomSpeed = 0.01;
      delta = -e.deltaY * zoomSpeed;
      isZoomGesture = true;
    }
    // Method 2: macOS touchpad pinch (small deltaY values without ctrl, deltaMode 0)
    else if (e.deltaMode === 0 && Math.abs(e.deltaY) < 50 && Math.abs(e.deltaY) > 0) {
      // macOS Safari/Chrome touchpad pinch
      const zoomSpeed = 0.01;
      delta = -e.deltaY * zoomSpeed;
      isZoomGesture = true;
    }
    // Method 3: Some touchpads report pinch without ctrlKey (very small deltaY values)
    else if (Math.abs(e.deltaY) < 4 && Math.abs(e.deltaY) > 0.1) {
      // Fine-grained touchpad movements that might be pinch
      const zoomSpeed = 0.02;
      delta = -e.deltaY * zoomSpeed;
      isZoomGesture = true;
    }
    // Method 4: Firefox touchpad pinch detection
    else if (e.deltaMode === 0 && Math.abs(e.deltaY) < 10 && Math.abs(e.deltaX) < 1) {
      // Firefox specific touchpad pinch pattern
      const zoomSpeed = 0.015;
      delta = -e.deltaY * zoomSpeed;
      isZoomGesture = true;
    }

    // Apply zoom if we detected a zoom gesture
    if (isZoomGesture && delta !== 0) {
      const newZoom = Math.max(0.1, Math.min(5, localViewport.zoom * (1 + delta)));
      
      if (Math.abs(newZoom - localViewport.zoom) > 0.001) {
        // Use immediate update for responsive feel during pinch
        const worldX = (mouseX - localViewport.x) / localViewport.zoom;
        const worldY = (mouseY - localViewport.y) / localViewport.zoom;
        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;

        const newViewport = { x: newX, y: newY, zoom: newZoom };
        setLocalViewport(newViewport);
        throttledWheelUpdate(newViewport);
        setIsZooming(true);
        
        // Clear zoom indicator after a delay
        setTimeout(() => setIsZooming(false), 100);
      }
      return;
    }

    // Regular scroll handling (not a zoom gesture)
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      // Vertical scroll
      if (!e.shiftKey) {
        // Regular mouse wheel zoom (larger deltaY values)
        if (Math.abs(e.deltaY) > 10) {
          const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
          const newZoom = Math.max(0.1, Math.min(5, localViewport.zoom * zoomFactor));

          if (newZoom !== localViewport.zoom) {
            const worldX = (mouseX - localViewport.x) / localViewport.zoom;
            const worldY = (mouseY - localViewport.y) / localViewport.zoom;
            const newX = mouseX - worldX * newZoom;
            const newY = mouseY - worldY * newZoom;

            throttledWheelUpdate({
              x: newX,
              y: newY,
              zoom: newZoom
            });
          }
        } else {
          // Small vertical movements - might be trackpad scroll
          const newY = localViewport.y - e.deltaY * 2;
          throttledWheelUpdate({
            ...localViewport,
            y: newY
          });
        }
      } else {
        // Shift + scroll - horizontal pan
        const newX = localViewport.x - e.deltaY;
        throttledWheelUpdate({
          ...localViewport,
          x: newX
        });
      }
    } else {
      // Horizontal scroll - pan horizontally
      const newX = localViewport.x - e.deltaX;
      throttledWheelUpdate({
        ...localViewport,
        x: newX
      });
    }
  }, [localViewport, throttledWheelUpdate, setIsZooming]);

  // Touch event handlers for pinch-to-zoom
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length === 0) return { x: 0, y: 0 };
    if (touches.length === 1) return { x: touches[0].clientX, y: touches[0].clientY };
    
    let x = 0, y = 0;
    for (let i = 0; i < touches.length; i++) {
      x += touches[i].clientX;
      y += touches[i].clientY;
    }
    return { x: x / touches.length, y: y / touches.length };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Two finger pinch
      e.preventDefault();
      isTouchZooming.current = true;
      lastTouchDistance.current = getTouchDistance(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    } else if (e.touches.length === 1 && selectedTool === 'drag') {
      // Single finger pan (only when drag tool is selected)
      e.preventDefault();
      isDragging.current = true;
      const touch = e.touches[0];
      lastMousePos.current = { x: touch.clientX, y: touch.clientY };
    }
  }, [selectedTool]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && isTouchZooming.current) {
      // Pinch to zoom
      e.preventDefault();
      e.stopPropagation();

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentDistance = getTouchDistance(e.touches);
      const currentCenter = getTouchCenter(e.touches);

      if (lastTouchDistance.current > 0) {
        const zoomFactor = currentDistance / lastTouchDistance.current;
        const newZoom = Math.max(0.1, Math.min(5, localViewport.zoom * zoomFactor));

        // Convert touch center to canvas coordinates
        const canvasX = currentCenter.x - rect.left;
        const canvasY = currentCenter.y - rect.top;

        // Convert to world coordinates
        const worldX = (canvasX - localViewport.x) / localViewport.zoom;
        const worldY = (canvasY - localViewport.y) / localViewport.zoom;

        // Calculate new viewport position
        const newX = canvasX - worldX * newZoom;
        const newY = canvasY - worldY * newZoom;

        const newViewport = { x: newX, y: newY, zoom: newZoom };
        setLocalViewport(newViewport);
        throttledViewportUpdate(newViewport);
      }

      lastTouchDistance.current = currentDistance;
      lastTouchCenter.current = currentCenter;
    } else if (e.touches.length === 1 && isDragging.current) {
      // Single finger pan
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastMousePos.current.x;
      const deltaY = touch.clientY - lastMousePos.current.y;

      const newViewport = {
        x: localViewport.x + deltaX,
        y: localViewport.y + deltaY,
        zoom: localViewport.zoom
      };

      setLocalViewport(newViewport);
      throttledViewportUpdate(newViewport);
      lastMousePos.current = { x: touch.clientX, y: touch.clientY };
    }
  }, [localViewport, throttledViewportUpdate]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      isTouchZooming.current = false;
      lastTouchDistance.current = 0;
    }
    if (e.touches.length === 0) {
      isDragging.current = false;
    }
  }, []);

  // Native wheel event handler for passive: false
  const handleNativeWheel = useCallback((e: WheelEvent) => {
    // Always prevent default to stop browser zoom
    e.preventDefault();
    e.stopPropagation();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const centerPoint = { x: mouseX, y: mouseY };

    let delta = 0;
    let isZoomGesture = false;

    // Comprehensive pinch gesture detection for all browsers/platforms
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) * 2) {
      // Zoom gesture detected
      isZoomGesture = true;
      
      // Normalize delta across different browsers and platforms
      if (e.deltaMode === 1) { // DOM_DELTA_LINE
        delta = e.deltaY * 33; // Convert lines to pixels
      } else if (e.deltaMode === 2) { // DOM_DELTA_PAGE
        delta = e.deltaY * 1000; // Convert pages to pixels
      } else { // DOM_DELTA_PIXEL
        delta = e.deltaY;
      }

      // Handle different browsers' scaling
      if (Math.abs(delta) > 100) {
        delta = Math.sign(delta) * Math.min(Math.abs(delta), 100);
      }

      // Apply zoom with momentum-based scaling
      const scaleFactor = Math.pow(0.99, delta / 10);
      const currentZoom = localViewport.zoom;
      const newZoom = Math.max(0.1, Math.min(5, currentZoom * scaleFactor));
      
      if (newZoom !== currentZoom) {
        const zoomRatio = newZoom / currentZoom;
        const newX = centerPoint.x - (centerPoint.x - localViewport.x) * zoomRatio;
        const newY = centerPoint.y - (centerPoint.y - localViewport.y) * zoomRatio;

        const newViewport = {
          x: newX,
          y: newY,
          zoom: newZoom
        };

        setIsZooming(true);
        throttledWheelUpdate(newViewport);

        // Clear zoom state after animation
        if (zoomAnimationId.current) {
          clearTimeout(zoomAnimationId.current);
        }
        zoomAnimationId.current = setTimeout(() => setIsZooming(false), 100) as any;
      }
    } else {
      // Regular scroll/pan
      const sensitivity = 1;
      const deltaX = e.deltaX * sensitivity;
      const deltaY = e.deltaY * sensitivity;

      const newViewport = {
        ...localViewport,
        x: localViewport.x - deltaX,
        y: localViewport.y - deltaY
      };

      throttledWheelUpdate(newViewport);
    }
  }, [localViewport, throttledWheelUpdate]);

  // Wheel event listener with passive: false
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    canvasElement.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvasElement.removeEventListener('wheel', handleNativeWheel);
  }, [handleNativeWheel]);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canvasRef.current) return;

      // Only handle zoom if the canvas is focused or no input is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      );

      if (isInputFocused) return;

      if ((e.ctrlKey || e.metaKey)) {
        const rect = canvasRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const currentViewport = localViewport;
          const worldX = (centerX - currentViewport.x) / currentViewport.zoom;
          const worldY = (centerY - currentViewport.y) / currentViewport.zoom;
          const newZoom = Math.min(5, currentViewport.zoom * 1.2);
          const newX = centerX - worldX * newZoom;
          const newY = centerY - worldY * newZoom;

          const newViewport = { x: newX, y: newY, zoom: newZoom };
          setLocalViewport(newViewport);
          updateViewport(newViewport);
        } else if (e.key === '-') {
          e.preventDefault();
          const currentViewport = localViewport;
          const worldX = (centerX - currentViewport.x) / currentViewport.zoom;
          const worldY = (centerY - currentViewport.y) / currentViewport.zoom;
          const newZoom = Math.max(0.1, currentViewport.zoom * 0.8);
          const newX = centerX - worldX * newZoom;
          const newY = centerY - worldY * newZoom;

          const newViewport = { x: newX, y: newY, zoom: newZoom };
          setLocalViewport(newViewport);
          updateViewport(newViewport);
        } else if (e.key === '0') {
          e.preventDefault();
          const newViewport = { x: 0, y: 0, zoom: 1 };
          setLocalViewport(newViewport);
          updateViewport(newViewport);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [localViewport, updateViewport]);

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

  // Enhanced event listeners for comprehensive zoom prevention and debug
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Debug mode - log wheel events to help identify touchpad behavior
    const debugWheelEvents = process.env.NODE_ENV === 'development';

    // Comprehensive wheel event handler for native events
    const handleNativeWheel = (e: WheelEvent) => {
      // Debug logging
      if (debugWheelEvents) {
        console.log('Native wheel event:', {
          deltaY: e.deltaY,
          deltaX: e.deltaX,
          deltaMode: e.deltaMode,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          type: 'wheel'
        });
      }

      // Always prevent browser zoom for any wheel event on canvas
      e.preventDefault();
      e.stopPropagation();
    };

    const preventTouchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Add comprehensive event listeners
    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    canvas.addEventListener('touchstart', preventTouchZoom, { passive: false });
    canvas.addEventListener('touchmove', preventTouchZoom, { passive: false });

    // Additional gesture prevention for various browsers
    const preventGesture = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Prevent various gesture events
    canvas.addEventListener('gesturestart', preventGesture, { passive: false });
    canvas.addEventListener('gesturechange', preventGesture, { passive: false });
    canvas.addEventListener('gestureend', preventGesture, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleNativeWheel);
      canvas.removeEventListener('touchstart', preventTouchZoom);
      canvas.removeEventListener('touchmove', preventTouchZoom);
      canvas.removeEventListener('gesturestart', preventGesture);
      canvas.removeEventListener('gesturechange', preventGesture);
      canvas.removeEventListener('gestureend', preventGesture);
    };
  }, []);

  // Note: Native gesture events are now handled by the comprehensive wheel handler above
  // This provides better cross-browser compatibility and more reliable pinch detection

  // Pointer Events API handlers (modern approach)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Handle two-finger pinch with pointer events
      if (pointers.current.size === 2) {
        const points = Array.from(pointers.current.values());
        const currentDistance = Math.hypot(
          points[1].x - points[0].x,
          points[1].y - points[0].y
        );

        if (lastPinchDistance.current > 0 && Math.abs(currentDistance - lastPinchDistance.current) > 5) {
          const scaleFactor = currentDistance / lastPinchDistance.current;
          const newZoom = Math.max(0.1, Math.min(5, localViewport.zoom * scaleFactor));

          // Calculate center point between the two touches
          const centerX = (points[0].x + points[1].x) / 2;
          const centerY = (points[0].y + points[1].y) / 2;
          
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const canvasX = centerX - rect.left;
            const canvasY = centerY - rect.top;
            animateZoom(newZoom, { x: canvasX, y: canvasY });
          }
        }

        lastPinchDistance.current = currentDistance;
      }
    }
  }, [localViewport, animateZoom]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) {
        lastPinchDistance.current = 0;
        setIsZooming(false);
      }
    }
  }, []);

  // Gesture events are now handled through the comprehensive wheel handler above
  // for better cross-browser compatibility

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (zoomAnimationId.current) {
        cancelAnimationFrame(zoomAnimationId.current);
      }
    };
  }, []);

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-hidden bg-gray-50 dark:bg-gray-900 canvas-optimized"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        cursor: selectedTool === 'drag' ? 'grab' : (isDragging.current ? 'grabbing' : 'default'),
        touchAction: 'none', // Prevent all default touch behaviors
        userSelect: 'none',
        contain: 'layout style paint',
        // Additional CSS to prevent zoom
        msContentZooming: 'none' as any,
        msTouchAction: 'none' as any,
        WebkitUserSelect: 'none' as any,
        MozUserSelect: 'none' as any,
      }}
    >
      {/* Figma-style Grid Background */}
      <div
        className="absolute inset-0 canvas-grid pointer-events-none"
        style={{
          backgroundSize: `${20 * localViewport.zoom}px ${20 * localViewport.zoom}px`,
          backgroundPosition: `${localViewport.x % (20 * localViewport.zoom)}px ${localViewport.y % (20 * localViewport.zoom)}px`,
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

      {/* Zoom Controls - Figma Style */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 glass-effect rounded-lg shadow-figma p-2 border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => {
            const newZoom = Math.max(0.1, localViewport.zoom - 0.1);
            animateZoom(newZoom);
          }}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors"
        >
          −
        </button>
        <span className="px-2 text-sm text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
          {Math.round(localViewport.zoom * 100)}%
        </span>
        <button
          onClick={() => {
            const newZoom = Math.min(5, localViewport.zoom + 0.1);
            animateZoom(newZoom);
          }}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors"
        >
          +
        </button>
        <button
          onClick={() => {
            animateZoom(1, null);
            // Reset position after zoom animation
            setTimeout(() => {
              const newViewport = { x: 0, y: 0, zoom: 1 };
              setLocalViewport(newViewport);
              updateViewport(newViewport);
            }, 150);
          }}
          className="px-3 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Zoom Indicator - Shows during zoom operations */}
      {isZooming && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 glass-effect px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {Math.round(localViewport.zoom * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Zoom bounds feedback */}
      {(localViewport.zoom <= 0.11 || localViewport.zoom >= 4.99) && (
        <div className="absolute top-4 right-4 glass-effect px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <span className="text-sm text-amber-800 dark:text-amber-200">
            {localViewport.zoom <= 0.11 ? 'Minimum zoom reached' : 'Maximum zoom reached'}
          </span>
        </div>
      )}

      {/* Viewport Info (Debug) - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 left-4 glass-effect text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400">
            Zoom: {(localViewport.zoom * 100).toFixed(0)}% | X: {Math.round(localViewport.x)} | Y: {Math.round(localViewport.y)}
          </span>
        </div>
      )}
    </div>
  );
}