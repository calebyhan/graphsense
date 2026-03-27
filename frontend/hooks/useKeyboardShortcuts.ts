import { useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { getActiveWebSocket } from '@/lib/realtime/canvasWebSocket';

export function useKeyboardShortcuts(isReadOnly = false) {
  const { setSelectedTool, resetViewport, clearSelection } = useCanvasStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Meta shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'c':
            if (!isReadOnly) {
              const sel = useCanvasStore.getState().selectedElements;
              if (sel.length > 0) {
                useCanvasStore.getState().copyElements(sel);
                e.preventDefault();
              }
            }
            break;
          case 'v':
            if (!isReadOnly) {
              const newIds = useCanvasStore.getState().pasteElements();
              if (newIds.length > 0) {
                const { canvasElements } = useCanvasStore.getState();
                newIds.forEach((id) => {
                  const el = canvasElements.find((e) => e.id === id);
                  if (!el) {
                    console.error('[useKeyboardShortcuts] Ctrl+V: pasted element missing from store', { id });
                    return;
                  }
                  getActiveWebSocket()?.sendElementAdd(el);
                });
              }
              e.preventDefault();
            }
            break;
          // Zoom/fit handled by InfiniteCanvas which has correct viewport math
        }
        return;
      }

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
        case 'backspace': {
          if (!isReadOnly) {
            // Read fresh state inside the handler to avoid stale closure issues
            const { selectedElements, removeElement } = useCanvasStore.getState();
            if (selectedElements.length > 0) {
              selectedElements.forEach(id => {
                getActiveWebSocket()?.sendElementRemove(id);
                removeElement(id);
              });
              e.preventDefault();
            }
          }
          break;
        }
        case 'escape':
          clearSelection();
          setSelectedTool('pointer');
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [setSelectedTool, resetViewport, clearSelection, isReadOnly]);
}