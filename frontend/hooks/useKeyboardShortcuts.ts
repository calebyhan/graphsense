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
          if (e.shiftKey) {
            setSelectedTool('text');
          } else {
            setSelectedTool('table');
          }
          e.preventDefault();
          break;
        case 'm':
          setSelectedTool('map');
          e.preventDefault();
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
  }, [setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection, isReadOnly]);
}