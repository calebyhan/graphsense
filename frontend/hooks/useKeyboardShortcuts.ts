import { useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { getActiveWebSocket } from '@/lib/realtime/canvasWebSocket';

export function useKeyboardShortcuts(isReadOnly = false) {
  const { setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection, canvasElements, updateViewport, viewport, canvasContainerSize } = useCanvasStore();

  const handleZoomIn = () => {
    // Zoom in by 10% increments for finer control
    const newZoom = Math.min(5, viewport.zoom + 0.1);
    updateViewport({ ...viewport, zoom: newZoom });
  };

  const handleZoomOut = () => {
    // Zoom out by 10% increments for finer control
    const newZoom = Math.max(0.1, viewport.zoom - 0.1);
    updateViewport({ ...viewport, zoom: newZoom });
  };

  const handleFitToScreen = () => {
    if (canvasElements.length === 0) {
      // No elements, return to origin (0, 0) with default zoom
      updateViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    canvasElements.forEach(element => {
      const left = element.position.x;
      const top = element.position.y;
      const right = element.position.x + element.size.width;
      const bottom = element.position.y + element.size.height;

      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });

    const padding = 50;
    const boundingWidth = maxX - minX + padding * 2;
    const boundingHeight = maxY - minY + padding * 2;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const { width: cW, height: cH } = canvasContainerSize;
    const fitZoom = Math.min(cW / boundingWidth, cH / boundingHeight, 3);
    const targetZoom = Math.max(0.1, fitZoom);
    const targetX = -centerX * targetZoom;
    const targetY = -centerY * targetZoom;
    updateViewport({ x: targetX, y: targetY, zoom: targetZoom });
  };

  useEffect(() => {
    // Only add event listeners on the client side
    if (typeof window === 'undefined') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'v':
          if (!e.ctrlKey && !e.metaKey) {
            setSelectedTool('pointer');
            e.preventDefault();
          }
          break;
        case 'h':
          if (!e.ctrlKey && !e.metaKey) {
            setSelectedTool('drag');
            e.preventDefault();
          }
          break;
        case 't':
          if (e.shiftKey) {
            setSelectedTool('text');
            e.preventDefault();
          } else if (!e.ctrlKey && !e.metaKey) {
            setSelectedTool('table');
            e.preventDefault();
          }
          break;
        case 'c':
          if (!e.ctrlKey && !e.metaKey) {
            setSelectedTool('chart');
            e.preventDefault();
          }
          break;
        case 'm':
          if (!e.ctrlKey && !e.metaKey) {
            setSelectedTool('map');
            e.preventDefault();
          }
          break;
        case 'n':
          if (!e.ctrlKey && !e.metaKey) {
            setSelectedTool('note');
            e.preventDefault();
          }
          break;
        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            handleFitToScreen();
            e.preventDefault();
          }
          break;
        case '=':
        case '+':
          if (e.ctrlKey || e.metaKey) {
            handleZoomIn();
            e.preventDefault();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            handleZoomOut();
            e.preventDefault();
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            handleFitToScreen();
            e.preventDefault();
          }
          break;
        case ' ':
          resetViewport();
          e.preventDefault();
          break;
        case 'delete':
        case 'backspace':
          if (!isReadOnly && selectedElements.length > 0) {
            selectedElements.forEach(id => {
              getActiveWebSocket()?.sendElementRemove(id);
              removeElement(id);
            });
            e.preventDefault();
          }
          break;
        case 'escape':
          clearSelection();
          setSelectedTool('pointer');
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection, handleFitToScreen, handleZoomIn, handleZoomOut, viewport, canvasContainerSize, isReadOnly]);
}