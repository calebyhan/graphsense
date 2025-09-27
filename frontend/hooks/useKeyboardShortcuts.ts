import { useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';

export function useKeyboardShortcuts() {
  const { setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection, toggleDatasetPanel } = useCanvasStore();

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
        case 'd':
          if (!e.ctrlKey && !e.metaKey) {
            toggleDatasetPanel();
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
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [setSelectedTool, resetViewport, selectedElements, removeElement, clearSelection, toggleDatasetPanel]);
}