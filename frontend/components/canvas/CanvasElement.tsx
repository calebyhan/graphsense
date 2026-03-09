'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useCanvasStore, CanvasElement as CanvasElementType } from '@/store/useCanvasStore';
import { getActiveWebSocket } from '@/lib/realtime/canvasWebSocket';
import { Move, X, Maximize2 } from 'lucide-react';

function useOptimizedRaf<T extends (...args: any[]) => void>(func: T): T {
  const rafId = useRef<number | undefined>(undefined);
  const lastArgs = useRef<any[]>([]);
  const isScheduled = useRef(false);

  const throttledFunc = useCallback((...args: any[]) => {
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
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return throttledFunc as T;
}

interface CanvasElementProps {
  element: CanvasElementType;
  children: React.ReactNode;
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}

export default function CanvasElement({ element, children, isSelected, onSelect, onDelete }: CanvasElementProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [localPosition, setLocalPosition] = useState(element.position);
  const [localSize, setLocalSize] = useState(element.size);

  // Lock renew interval
  const lockRenewTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync local state with element props
  useEffect(() => {
    if (!isDragging) setLocalPosition(element.position);
  }, [element.position, isDragging]);

  useEffect(() => {
    if (!isResizing) setLocalSize(element.size);
  }, [element.size, isResizing]);

  const {
    updateElement,
    selectElements,
    selectedElements,
    viewport,
    isElementLockedByOther,
  } = useCanvasStore();

  const lockedByOther = isElementLockedByOther(element.id);
  const lockHolder = useCanvasStore((s) => s.getElementLockHolder(element.id));

  // Throttled update functions
  const throttledPositionUpdate = useOptimizedRaf(useCallback((id: string, position: { x: number; y: number }) => {
    updateElement(id, { position });
  }, [updateElement]));

  const throttledSizeUpdate = useOptimizedRaf(useCallback((id: string, size: { width: number; height: number }) => {
    updateElement(id, { size });
  }, [updateElement]));

  // Broadcast live position to collaborators (throttled via RAF)
  const throttledWsMove = useOptimizedRaf(useCallback((id: string, position: { x: number; y: number }) => {
    getActiveWebSocket()?.sendElementMove(id, position);
  }, []));

  const isStoreSelected = selectedElements.includes(element.id);
  const isActuallySelected = isSelected || isStoreSelected;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start dragging if clicking on a button or interactive element
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    if (e.target !== e.currentTarget && !target.closest('.element-header')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Block interaction if locked by another user
    if (lockedByOther) {
      return;
    }

    // Select this element if not already selected
    if (!isActuallySelected && onSelect) {
      onSelect();
      selectElements([element.id]);
    }

    // Request lock via WS
    getActiveWebSocket()?.sendLockRequest(element.id);

    setIsDragging(true);
    setDragStart({
      x: e.clientX - element.position.x * viewport.zoom,
      y: e.clientY - element.position.y * viewport.zoom,
    });
  }, [element.id, element.position, isSelected, selectElements, viewport.zoom, lockedByOther, isActuallySelected, onSelect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = (e.clientX - dragStart.x) / viewport.zoom;
      const newY = (e.clientY - dragStart.y) / viewport.zoom;
      const newPosition = { x: newX, y: newY };

      // Update local state immediately for smooth visual feedback
      setLocalPosition(newPosition);
      // Throttle the store update
      throttledPositionUpdate(element.id, newPosition);
      // Broadcast live position to collaborators
      throttledWsMove(element.id, newPosition);
    } else if (isResizing) {
      const newWidth = Math.max(200, resizeStart.width + (e.clientX - resizeStart.x) / viewport.zoom);
      const newHeight = Math.max(150, resizeStart.height + (e.clientY - resizeStart.y) / viewport.zoom);
      const newSize = { width: newWidth, height: newHeight };

      // Update local state immediately for smooth visual feedback
      setLocalSize(newSize);
      // Throttle the store update
      throttledSizeUpdate(element.id, newSize);
    }
  }, [isDragging, isResizing, dragStart, resizeStart, element.id, throttledPositionUpdate, throttledSizeUpdate, throttledWsMove, viewport.zoom]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // Commit final position via WS (triggers DB write + lock release on server)
      getActiveWebSocket()?.sendElementCommit(
        element.id,
        localPosition,
        localSize,
        element.data
      );
    }
    setIsDragging(false);
    setIsResizing(false);

    // Clear lock renew timer
    if (lockRenewTimer.current) {
      clearInterval(lockRenewTimer.current);
      lockRenewTimer.current = null;
    }
  }, [isDragging, element.id, localPosition, localSize, element.data]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (lockedByOther) return;

    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: element.size.width,
      height: element.size.height,
    });
  }, [element.size, lockedByOther]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDelete) return;
    if (lockedByOther) return;
    onDelete();
  }, [onDelete, lockedByOther]);

  // Add global event listeners for drag/resize
  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={elementRef}
      className={`absolute bg-white rounded-lg shadow-lg border-2 canvas-element-optimized ${isDragging || isResizing ? 'performance-mode' : 'smooth-transition'} ${
        isActuallySelected ? 'border-blue-500 shadow-xl' : lockedByOther ? 'border-orange-400' : 'border-gray-200'
      } ${lockedByOther ? 'cursor-not-allowed' : isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: localPosition.x,
        top: localPosition.y,
        width: localSize.width,
        height: localSize.height,
        zIndex: element.zIndex || 0,
        willChange: isDragging || isResizing ? 'transform' : 'auto',
        transform: isDragging || isResizing ? 'translateZ(0)' : 'none',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Element Header */}
      <div className="element-header flex items-center justify-between p-2 bg-gray-50 rounded-t-lg border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Move className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 capitalize">
            {element.type}
          </span>
          {lockedByOther && lockHolder && (
            <span className="text-xs text-orange-500 font-medium">
              Locked by {lockHolder.displayName}
            </span>
          )}
        </div>

        {onDelete && !lockedByOther && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors relative z-10"
              title="Delete element"
              style={{ pointerEvents: 'auto' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Element Content */}
      <div className="flex-1 overflow-auto" style={{
        pointerEvents: isDragging || isResizing ? 'none' : 'auto',
        height: `calc(100% - ${element.type === 'text' ? '60px' : '56px'})`
      }}>
        <div className="p-4 h-full">
          {children}
        </div>
      </div>

      {/* Resize Handle */}
      {isSelected && !lockedByOther && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 rounded-tl-lg cursor-se-resize opacity-75 hover:opacity-100 transition-opacity"
          onMouseDown={handleResizeStart}
          title="Resize"
        >
          <Maximize2 className="h-3 w-3 text-white absolute bottom-0.5 right-0.5" />
        </div>
      )}

      {/* Selection Indicators */}
      {isSelected && (
        <>
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
        </>
      )}
    </div>
  );
}
