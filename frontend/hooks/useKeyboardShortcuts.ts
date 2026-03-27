import { useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { getActiveWebSocket } from '@/lib/realtime/canvasWebSocket';

export function useKeyboardShortcuts(isReadOnly = false) {
  const { setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection } = useCanvasStore();


  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Meta shortcuts (zoom/fit) are handled by InfiniteCanvas which has correct viewport math
      if (e.ctrlKey || e.metaKey) return;

      switch (e.key.toLowerCase()) {
        case 'v':
          setSelectedTool('pointer');
          e.preventDefault();
          break;
        case 'h':
          setSelectedTool('drag');
          e.preventDefault();
          break;
        case 'c':
          setSelectedTool('chart');
          e.preventDefault();
          break;
        case 'd':
          setSelectedTool('dataset');
          e.preventDefault();
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
            useCanvasStore.getState().fitToScreen();
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
  }, [setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection, isReadOnly]);
}