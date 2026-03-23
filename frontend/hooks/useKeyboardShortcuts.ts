import { useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { getActiveWebSocket } from '@/lib/realtime/canvasWebSocket';

export function useKeyboardShortcuts(isReadOnly = false) {
  const { setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection } = useCanvasStore();

  // Read fresh state inside the handler to avoid stale closures
  const handleFitToScreen = useCallback(() => {
    const { canvasElements, canvasContainerSize, updateViewport } = useCanvasStore.getState();
    if (canvasElements.length === 0) {
      updateViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of canvasElements) {
      minX = Math.min(minX, el.position.x);
      minY = Math.min(minY, el.position.y);
      maxX = Math.max(maxX, el.position.x + el.size.width);
      maxY = Math.max(maxY, el.position.y + el.size.height);
    }

    const padding = 50;
    const boundingWidth = maxX - minX + padding * 2;
    const boundingHeight = maxY - minY + padding * 2;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const { width: cW, height: cH } = canvasContainerSize;
    const fitZoom = Math.min(cW / boundingWidth, cH / boundingHeight, 3);
    const targetZoom = Math.max(0.1, fitZoom);
    updateViewport({ x: -centerX * targetZoom, y: -centerY * targetZoom, zoom: targetZoom });
  }, []);

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
          if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
            setSelectedTool('text');
            e.preventDefault();
          } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
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
        // Ctrl+=/+, Ctrl+-, Ctrl+0 (zoom in/out/fit) are handled by InfiniteCanvas
        // with pan-compensated zooming — do not duplicate here.
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
  }, [setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection, handleFitToScreen, isReadOnly]);
}