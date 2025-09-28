import { create } from 'zustand';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasElement {
  id: string;
  type: 'dataset' | 'chart' | 'table' | 'map' | 'text';
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any;
  selected?: boolean;
  zIndex?: number;
}

export type ToolType = 'pointer' | 'drag' | 'dataset' | 'table' | 'chart' | 'map' | 'text';

interface CanvasStore {
  viewport: Viewport;
  selectedTool: ToolType;
  canvasElements: CanvasElement[];
  selectedElements: string[];

  // Viewport actions
  updateViewport: (viewport: Viewport) => void;
  resetViewport: () => void;

  // Tool actions
  setSelectedTool: (tool: ToolType) => void;

  // Element actions
  addElement: (element: Omit<CanvasElement, 'id'>) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  removeElement: (id: string) => void;
  selectElements: (ids: string[]) => void;
  clearSelection: () => void;

  // Utility actions
  getElementById: (id: string) => CanvasElement | undefined;
  getSelectedElements: () => CanvasElement[];
  getViewportCenterPosition: () => { x: number; y: number };
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedTool: 'pointer',
  canvasElements: [],
  selectedElements: [],

  updateViewport: (viewport) => {
    // Batch viewport updates for better performance
    set({ viewport });
  },

  resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),

  setSelectedTool: (tool) => set({ selectedTool: tool }),

  addElement: (element) => {
    const id = `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newElement: CanvasElement = {
      ...element,
      id,
      zIndex: element.zIndex || get().canvasElements.length,
    };
    set((state) => ({
      canvasElements: [...state.canvasElements, newElement],
    }));
  },

  updateElement: (id, updates) => {
    set((state) => ({
      canvasElements: state.canvasElements.map((element) =>
        element.id === id ? { ...element, ...updates } : element
      ),
      selectedElements: []
    }));
  },

  removeElement: (id) => {
    set((state) => ({
      canvasElements: state.canvasElements.filter((element) => element.id !== id),
      selectedElements: state.selectedElements.filter((selectedId) => selectedId !== id),
    }));
  },

  selectElements: (ids) => {
    set((state) => ({
      selectedElements: ids,
      canvasElements: state.canvasElements.map((element) => ({
        ...element,
        selected: ids.includes(element.id),
      })),
    }));
  },

  clearSelection: () => {
    set((state) => ({
      selectedElements: [],
      canvasElements: state.canvasElements.map((element) => ({
        ...element,
        selected: false,
      })),
    }));
  },

  getElementById: (id) => {
    return get().canvasElements.find((element) => element.id === id);
  },

  getSelectedElements: () => {
    const { canvasElements, selectedElements } = get();
    return canvasElements.filter((element) => selectedElements.includes(element.id));
  },

  getViewportCenterPosition: () => {
    const { viewport } = get();
    // Return the center of the current viewport with small random offset to prevent stacking
    // Canvas transform: translate(centerX, centerY) translate(viewport.x, -viewport.y) scale(zoom)
    // Elements at world position (0,0) appear at screen center
    const offsetRange = 50; // pixels
    const randomOffsetX = (Math.random() - 0.5) * offsetRange;
    const randomOffsetY = (Math.random() - 0.5) * offsetRange;
    
    // For elements to appear in viewport center, they should be at world position (0,0)
    // The viewport shows the world region around (-viewport.x, viewport.y)
    return {
      x: -viewport.x / viewport.zoom + randomOffsetX, // World position for screen center
      y: viewport.y / viewport.zoom + randomOffsetY   // World position for screen center
    };
  },
}));