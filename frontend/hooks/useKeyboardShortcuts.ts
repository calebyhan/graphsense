import { useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';

export function useKeyboardShortcuts() {
  const { setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection, updateViewport, viewport } = useCanvasStore();

  useEffect(() => {
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
        case 'c':
          if (!e.ctrlKey && !e.metaKey) {
            setSelectedTool('chart');
            e.preventDefault();
          }
          break;
        case 't':
          if (!e.ctrlKey && !e.metaKey) {
            setSelectedTool('text');
            e.preventDefault();
          }
          break;
        case ' ':
          resetViewport();
          e.preventDefault();
          break;
        case 'delete':
        case 'backspace':
          if (selectedElements.length > 0) {
            selectedElements.forEach(id => removeElement(id));
            e.preventDefault();
          }
          break;
        case 'escape':
          clearSelection();
          setSelectedTool('pointer');
          e.preventDefault();
          break;
        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            // Fit to screen - return to Cartesian origin (0, 0)
            updateViewport({ x: 0, y: 0, zoom: 0.8 });
            e.preventDefault();
          }
          break;
      }

      // Zoom shortcuts with Ctrl/Cmd
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '=':
          case '+':
            const newZoomIn = Math.min(5, viewport.zoom * 1.2);
            updateViewport({ ...viewport, zoom: newZoomIn });
            e.preventDefault();
            break;
          case '-':
            const newZoomOut = Math.max(0.1, viewport.zoom * 0.8);
            updateViewport({ ...viewport, zoom: newZoomOut });
            e.preventDefault();
            break;
          case '0':
            // Fit to screen - return to Cartesian origin (0, 0)
            updateViewport({ x: 0, y: 0, zoom: 0.8 });
            e.preventDefault();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection, updateViewport, viewport]);
}