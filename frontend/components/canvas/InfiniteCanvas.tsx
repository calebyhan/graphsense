'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import CollaboratorCursors from './CollaboratorCursors';
import ElementLockOverlay from './ElementLockOverlay';

function useOptimizedRaf<T extends (...args: any[]) => void>(func: T): T {
  const rafId = useRef<number | undefined>(undefined);
  const lastArgs = useRef<any[]>([]);
  const isScheduled = useRef(false);

  const rafFunc = useCallback((...args: any[]) => {
    lastArgs.current = args;

    if (isScheduled.current) return;
    isScheduled.current = true;

    rafId.current = requestAnimationFrame(() => {
      func(...lastArgs.current);
      isScheduled.current = false;
      rafId.current = undefined;
    });
  }, [func]);

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return rafFunc as T;
}

interface InfiniteCanvasProps {
  children: React.ReactNode;
  onCanvasClick?: (e: React.MouseEvent) => void;
  onCursorMove?: (x: number, y: number) => void;
  minZoom?: number;
  canvasSize?: { width: number; height: number };
}

export default function InfiniteCanvas({ children, onCanvasClick, onCursorMove, minZoom = 0.1, canvasSize }: InfiniteCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [localViewport, setLocalViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const viewportRef = useRef(localViewport);

  // Touch gesture support
  const lastTouchDistance = useRef<number>(0);
  const lastTouchCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isTouchZooming = useRef(false);

  // Pointer pinch support
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistance = useRef<number>(0);

  const [isZooming, setIsZooming] = useState(false);
  const zoomAnimationId = useRef<number | undefined>(undefined);
  const zoomIndicatorTimeout = useRef<number | undefined>(undefined);

  const {
    viewport,
    updateViewport,
    updateCanvasContainerSize,
    selectedTool,
    canvasElements
  } = useCanvasStore();

  // Optimized viewport sync
  useEffect(() => {
    viewportRef.current = viewport;
    setLocalViewport(viewport);
  }, [viewport]);

  // Track actual canvas container size so MiniMap uses exact dimensions
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        updateCanvasContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    obs.observe(el);
    // Report initial size immediately
    updateCanvasContainerSize({ width: el.clientWidth, height: el.clientHeight });
    return () => obs.disconnect();
  }, [updateCanvasContainerSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (selectedTool === 'drag' || e.button === 1) {
      e.preventDefault();
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    } else if (selectedTool === 'pointer' && e.target === e.currentTarget) {
      const { clearSelection } = useCanvasStore.getState();
      clearSelection();
    }

    if (onCanvasClick && e.target === e.currentTarget) {
      onCanvasClick(e);
    }
  }, [selectedTool, onCanvasClick]);

  // Optimized viewport update - direct RAF for better performance
  const updateViewportRef = useRef(updateViewport);
  useEffect(() => {
    updateViewportRef.current = updateViewport;
  }, [updateViewport]);

  // Keep a stable ref to onCursorMove to avoid re-creating handleMouseMove
  const onCursorMoveRef = useRef(onCursorMove);
  useEffect(() => { onCursorMoveRef.current = onCursorMove; }, [onCursorMove]);

  const handleMouseMove = useOptimizedRaf((e: React.MouseEvent) => {
    // Emit cursor position to collaborators (world coords) on every move
    if (onCursorMoveRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cv = viewportRef.current;
        const screenX = e.clientX - rect.left - rect.width / 2;
        const screenY = e.clientY - rect.top - rect.height / 2;
        const worldX = (screenX - cv.x) / cv.zoom;
        const worldY = (screenY - cv.y) / cv.zoom;
        onCursorMoveRef.current(worldX, worldY);
      }
    }

    if (!isDragging.current) return;

    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;

    const currentViewport = viewportRef.current;
    const { x: cx, y: cy } = clampPan(
      currentViewport.x + deltaX,
      currentViewport.y + deltaY,
      currentViewport.zoom
    );
    const newViewport = { x: cx, y: cy, zoom: currentViewport.zoom };

    viewportRef.current = newViewport;
    setLocalViewport(newViewport);
    updateViewportRef.current(newViewport);

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  });

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = selectedTool === 'drag' ? 'grab' : 'default';
    }
  }, [selectedTool]);

  // Stable ref for canvasSize so clampPan can be used inside RAF callbacks without stale closures
  const canvasSizeRef = useRef(canvasSize);
  useEffect(() => { canvasSizeRef.current = canvasSize; }, [canvasSize]);

  // Clamp pan so the viewport indicator always stays within the minimap and content remains visible.
  // canvasSize is symmetric around world origin: spans [-hw, +hw] × [-hh, +hh] where hw = width/2.
  // Viewport right edge ≤ hw  → vx ≥ cW/2 - hw*zoom  (minVx)
  // Canvas left edge visible  → vx ≤ cW/2 - margin   (maxVx, preserves content visibility)
  // Also cap maxVx at hw*zoom - cW/2 so indicator left edge stays within minimap at low zoom.
  const clampPan = useCallback((vx: number, vy: number, zoom: number): { x: number; y: number } => {
    const el = canvasRef.current;
    const cs = canvasSizeRef.current;
    if (!el || !cs) return { x: vx, y: vy };
    const cW = el.clientWidth;
    const cH = el.clientHeight;
    const margin = 100;
    const hw = cs.width / 2;
    const hh = cs.height / 2;

    // When the scaled canvas is smaller than the viewport in a dimension, center it
    // rather than clamping (avoids min > max deadlock).
    let clampedX: number;
    if (hw * zoom <= cW / 2) {
      clampedX = 0; // world origin at viewport center
    } else {
      const minVx = cW / 2 - hw * zoom;
      const maxVx = Math.min(cW / 2 - margin, hw * zoom - cW / 2);
      clampedX = Math.max(minVx, Math.min(maxVx, vx));
    }

    let clampedY: number;
    if (hh * zoom <= cH / 2) {
      clampedY = 0;
    } else {
      const minVy = cH / 2 - hh * zoom;
      const maxVy = Math.min(cH / 2 - margin, hh * zoom - cH / 2);
      clampedY = Math.max(minVy, Math.min(maxVy, vy));
    }

    return { x: clampedX, y: clampedY };
  }, []);

  // Helper: screen <-> Cartesian using CSS coordinates (+Y down)
  const screenToCartesian = useCallback((screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // +y down to match CSS transforms
    return { x: screenX - centerX, y: screenY - centerY };
  }, []);

  // Create refs for animation functions to avoid closure issues
  const animateZoomRef = useRef<((targetZoom: number, centerPoint?: { x: number; y: number } | null) => void) | null>(null);
  const screenToCartesianRef = useRef(screenToCartesian);
  useEffect(() => {
    screenToCartesianRef.current = screenToCartesian;
  }, [screenToCartesian]);

  // Optimized zoom animation using requestAnimationFrame and refs
  const animateZoom = useCallback((targetZoom: number, centerPoint: { x: number; y: number } | null = null) => {
    if (zoomAnimationId.current) cancelAnimationFrame(zoomAnimationId.current);

    const startViewport = viewportRef.current;
    const startZoom = startViewport.zoom;
    const zoomDiff = targetZoom - startZoom;
    const duration = 120;
    const startTime = performance.now();

    if (Math.abs(zoomDiff) < 0.001) return;

    setIsZooming(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      const currentZoom = startZoom + (zoomDiff * eased);

      let newX = startViewport.x;
      let newY = startViewport.y;

      if (centerPoint) {
        const cartesian = screenToCartesianRef.current(centerPoint.x, centerPoint.y);
        const worldX = (cartesian.x - startViewport.x) / startZoom;
        const worldY = (cartesian.y - startViewport.y) / startZoom;
        newX = cartesian.x - worldX * currentZoom;
        newY = cartesian.y - worldY * currentZoom;
      }

      const clamped = clampPan(newX, newY, currentZoom);
      const newViewport = { x: clamped.x, y: clamped.y, zoom: currentZoom };
      viewportRef.current = newViewport;
      setLocalViewport(newViewport);
      updateViewportRef.current(newViewport);

      if (progress < 1) {
        zoomAnimationId.current = requestAnimationFrame(animate);
      } else {
        setIsZooming(false);
      }
    };

    zoomAnimationId.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    animateZoomRef.current = animateZoom;
  }, [animateZoom]);

  // Native wheel handler - optimized with RAF
  const handleNativeWheel = useOptimizedRaf((e: WheelEvent) => {
    // Always prevent browser zoom and page scroll when over canvas
    e.preventDefault();
    e.stopPropagation();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const centerPoint = { x: mouseX, y: mouseY };
    const currentViewport = viewportRef.current;

    // Zoom **only** when Ctrl/Cmd is held (trackpads: browsers synthesize ctrlKey on pinch)
    const isZoomGesture = e.ctrlKey || e.metaKey;

    if (isZoomGesture) {
      // Normalize delta across deltaModes
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 33;      // lines -> px
      else if (e.deltaMode === 2) delta *= 1000; // pages -> px

      // Clamp extreme values
      if (Math.abs(delta) > 100) delta = Math.sign(delta) * 100;

      const scaleFactor = Math.pow(0.995, delta / 8);
      const currentZoom = currentViewport.zoom;
      const newZoom = Math.max(minZoom, Math.min(5, currentZoom * scaleFactor));

      if (newZoom !== currentZoom) {
        // Convert to Cartesian (canvas-center origin) before computing zoom pivot
        const cW = rect.width;
        const cH = rect.height;
        const cartX = mouseX - cW / 2;
        const cartY = mouseY - cH / 2;
        const zoomRatio = newZoom / currentZoom;
        const rawX = cartX - (cartX - currentViewport.x) * zoomRatio;
        const rawY = cartY - (cartY - currentViewport.y) * zoomRatio;
        const { x: newX, y: newY } = clampPan(rawX, rawY, newZoom);

        const newViewport = { x: newX, y: newY, zoom: newZoom };
        viewportRef.current = newViewport;
        setIsZooming(true);
        setLocalViewport(newViewport);
        updateViewportRef.current(newViewport);

        // Clear zoom indicator shortly after
        if (zoomIndicatorTimeout.current) window.clearTimeout(zoomIndicatorTimeout.current);
        zoomIndicatorTimeout.current = window.setTimeout(() => setIsZooming(false), 100);
      }
    } else {
      // Regular pan (natural trackpad feel: content follows finger)
      const { x: cx, y: cy } = clampPan(
        currentViewport.x - e.deltaX,
        currentViewport.y - e.deltaY,
        currentViewport.zoom
      );
      const newViewport = { ...currentViewport, x: cx, y: cy };

      viewportRef.current = newViewport;
      setLocalViewport(newViewport);
      updateViewportRef.current(newViewport);
    }
  });

  // Attach a single wheel listener with passive: false
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleNativeWheel);
  }, [handleNativeWheel]);

  // Keyboard shortcuts for zoom/fit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canvasRef.current) return;

      const active = document.activeElement as HTMLElement | null;
      const isInputFocused =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable);

      if (isInputFocused) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const current = viewportRef.current;
          const worldX = (0 - current.x) / current.zoom;
          const worldY = (0 - current.y) / current.zoom;
          const newZoom = Math.min(5, current.zoom + 0.15);
          const { x: newX, y: newY } = clampPan(0 - worldX * newZoom, 0 - worldY * newZoom, newZoom);

          const nv = { x: newX, y: newY, zoom: newZoom };
          viewportRef.current = nv;
          setLocalViewport(nv);
          updateViewport(nv);
        } else if (e.key === '-') {
          e.preventDefault();
          const current = viewportRef.current;
          const worldX = (0 - current.x) / current.zoom;
          const worldY = (0 - current.y) / current.zoom;
          const newZoom = Math.max(minZoom, current.zoom - 0.15);
          const { x: newX, y: newY } = clampPan(0 - worldX * newZoom, 0 - worldY * newZoom, newZoom);

          const nv = { x: newX, y: newY, zoom: newZoom };
          viewportRef.current = nv;
          setLocalViewport(nv);
          updateViewport(nv);
        } else if (e.key === '0') {
          e.preventDefault();

          if (canvasElements.length === 0) {
            const nv = { x: 0, y: 0, zoom: 1 };
            viewportRef.current = nv;
            setLocalViewport(nv);
            updateViewport(nv);
            return;
          }

          // Fit all elements - optimized
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const element of canvasElements) {
            const left = element.position.x;
            const top = element.position.y;
            const right = element.position.x + element.size.width;
            const bottom = element.position.y + element.size.height;

            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, right);
            maxY = Math.max(maxY, bottom);
          }

          const padding = 50;
          const boundingWidth = maxX - minX + padding * 2;
          const boundingHeight = maxY - minY + padding * 2;

          const centerX_elements = (minX + maxX) / 2;
          const centerY_elements = (minY + maxY) / 2;

          // Use actual container dimensions for accurate fit calculation
          const containerEl = canvasRef.current;
          const viewportWidth = containerEl ? containerEl.clientWidth : 800;
          const viewportHeight = containerEl ? containerEl.clientHeight : 600;

          const zoomX = viewportWidth / boundingWidth;
          const zoomY = viewportHeight / boundingHeight;
          const fitZoom = Math.min(Math.min(zoomX, zoomY), 3);

          const targetZoom = Math.max(minZoom, fitZoom);

          // In the center-origin coordinate system vx=0 places world origin at screen center.
          // To center elements at (cx, cy): vx = -cx * zoom
          const targetX = -centerX_elements * targetZoom;
          const targetY = -centerY_elements * targetZoom;

          const nv = { x: targetX, y: targetY, zoom: targetZoom };
          viewportRef.current = nv;
          setLocalViewport(nv);
          updateViewport(nv);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [updateViewport, canvasElements]);

  // Set cursor based on selected tool
  useEffect(() => {
    if (!canvasRef.current) return;
    switch (selectedTool) {
      case 'pointer':
        canvasRef.current.style.cursor = 'default';
        break;
      case 'drag':
        canvasRef.current.style.cursor = isDragging.current ? 'grabbing' : 'grab';
        break;
      default:
        canvasRef.current.style.cursor = 'crosshair';
    }
  }, [selectedTool]);

  // ----- Touch & Pointer (pinch + pan) -----

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const t1 = touches[0], t2 = touches[1];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length === 0) return { x: 0, y: 0 };
    if (touches.length === 1) return { x: touches[0].clientX, y: touches[0].clientY };
    let x = 0, y = 0;
    for (let i = 0; i < touches.length; i++) { x += touches[i].clientX; y += touches[i].clientY; }
    return { x: x / touches.length, y: y / touches.length };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      isTouchZooming.current = true;
      lastTouchDistance.current = getTouchDistance(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    } else if (e.touches.length === 1 && selectedTool === 'drag') {
      e.preventDefault();
      isDragging.current = true;
      const t = e.touches[0];
      lastMousePos.current = { x: t.clientX, y: t.clientY };
    }
  }, [selectedTool]);

  // Create optimized viewport update function for touch events
  const throttledViewportUpdate = useOptimizedRaf((newViewport: typeof viewport) => {
    viewportRef.current = newViewport;
    updateViewportRef.current(newViewport);
  });

  const handleTouchMove = useOptimizedRaf((e: React.TouchEvent) => {
    const currentViewport = viewportRef.current;

    if (e.touches.length === 2 && isTouchZooming.current) {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentDistance = getTouchDistance(e.touches);
      const currentCenter = getTouchCenter(e.touches);

      if (lastTouchDistance.current > 0) {
        const zoomFactor = currentDistance / lastTouchDistance.current;
        const newZoom = Math.max(minZoom, Math.min(5, currentViewport.zoom * zoomFactor));

        const canvasX = currentCenter.x - rect.left;
        const canvasY = currentCenter.y - rect.top;

        // Convert to Cartesian (canvas-center origin) before computing zoom pivot
        const cartX = canvasX - rect.width / 2;
        const cartY = canvasY - rect.height / 2;
        const worldX = (cartX - currentViewport.x) / currentViewport.zoom;
        const worldY = (cartY - currentViewport.y) / currentViewport.zoom;

        const { x: newX, y: newY } = clampPan(cartX - worldX * newZoom, cartY - worldY * newZoom, newZoom);

        const nv = { x: newX, y: newY, zoom: newZoom };
        viewportRef.current = nv;
        setLocalViewport(nv);
        throttledViewportUpdate(nv);
      }

      lastTouchDistance.current = currentDistance;
      lastTouchCenter.current = currentCenter;
    } else if (e.touches.length === 1 && isDragging.current) {
      e.preventDefault();
      const t = e.touches[0];
      const deltaX = t.clientX - lastMousePos.current.x;
      const deltaY = t.clientY - lastMousePos.current.y;

      const { x: cx, y: cy } = clampPan(
        currentViewport.x + deltaX,
        currentViewport.y + deltaY,
        currentViewport.zoom
      );
      const nv = { x: cx, y: cy, zoom: currentViewport.zoom };
      viewportRef.current = nv;
      setLocalViewport(nv);
      throttledViewportUpdate(nv);
      lastMousePos.current = { x: t.clientX, y: t.clientY };
    }
  });

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      isTouchZooming.current = false;
      lastTouchDistance.current = 0;
    }
    if (e.touches.length === 0) {
      isDragging.current = false;
    }
  }, []);

  // Pointer Events pinch
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }, []);

  const handlePointerMove = useOptimizedRaf((e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 2) {
        const pts = Array.from(pointers.current.values());
        const currentDistance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);

        if (lastPinchDistance.current > 0 && Math.abs(currentDistance - lastPinchDistance.current) > 5) {
          const scaleFactor = currentDistance / lastPinchDistance.current;
          const newZoom = Math.max(minZoom, Math.min(5, viewportRef.current.zoom * scaleFactor));

          const centerX = (pts[0].x + pts[1].x) / 2;
          const centerY = (pts[0].y + pts[1].y) / 2;

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
  });

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) {
        lastPinchDistance.current = 0;
        setIsZooming(false);
      }
    }
  }, []);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (zoomAnimationId.current) cancelAnimationFrame(zoomAnimationId.current);
      if (zoomIndicatorTimeout.current) window.clearTimeout(zoomIndicatorTimeout.current);
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
      // NOTE: no onWheel here — we use a single native wheel listener instead
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        cursor: selectedTool === 'drag' ? (isDragging.current ? 'grabbing' : 'grab') : 'default',
        touchAction: 'none',
        userSelect: 'none',
        contain: 'layout style paint',
        msContentZooming: 'none' as any,
        msTouchAction: 'none' as any,
        WebkitUserSelect: 'none' as any,
        MozUserSelect: 'none' as any,
      }}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 canvas-grid pointer-events-none"
        style={{
          backgroundSize: `${20 * localViewport.zoom}px ${20 * localViewport.zoom}px`,
          backgroundPosition: `${((canvasRef.current ? canvasRef.current.clientWidth / 2 : 0) + localViewport.x) % (20 * localViewport.zoom)}px ${((canvasRef.current ? canvasRef.current.clientHeight / 2 : 0) + localViewport.y) % (20 * localViewport.zoom)}px`,
          willChange: 'transform',
          transform: 'translateZ(0)',
          contain: 'strict',
        }}
      />

      {/* Content */}
      <div
        className="absolute canvas-optimized"
        style={{
          transform: `translate(${canvasRef.current ? canvasRef.current.clientWidth / 2 : 0}px, ${canvasRef.current ? canvasRef.current.clientHeight / 2 : 0}px) translate(${localViewport.x}px, ${localViewport.y}px) scale(${localViewport.zoom})`,
          transformOrigin: '0 0',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
        }}
      >
        {children}
        <ElementLockOverlay />
      </div>

      {/* Collaborator cursors — rendered outside canvas transform (screen-space) */}
      <CollaboratorCursors />

      {/* Zoom Indicator */}
      {isZooming && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 glass-effect px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {Math.round(localViewport.zoom * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Zoom bounds feedback */}
      {(localViewport.zoom <= minZoom * 1.05 || localViewport.zoom >= 4.99) && (
        <div className="absolute top-4 right-4 glass-effect px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <span className="text-sm text-amber-800 dark:text-amber-200">
            {localViewport.zoom <= minZoom * 1.05 ? 'Minimum zoom reached' : 'Maximum zoom reached'}
          </span>
        </div>
      )}

      {/* Debug (dev only) */}
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
