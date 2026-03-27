import { create } from 'zustand';
import { computeCanvasBounds } from '@/lib/utils/canvasBounds';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasElement {
  id: string;
  type: 'dataset' | 'chart' | 'table' | 'map' | 'text' | 'note';
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any;
  selected?: boolean;
  zIndex?: number;
}

export type ToolType = 'pointer' | 'drag' | 'dataset' | 'table' | 'chart' | 'map' | 'text' | 'note';

// --- Collaboration types ---

export interface CollaboratorState {
  userId: string;
  displayName: string;
  color: string;
  cursor?: { x: number; y: number };
}

export type ElementLocks = Record<string, string>; // element_id → user_id

/** Raw row shape returned by the DB or sent over WebSocket — may use snake_case field names. */
export interface ServerElementRow {
  id: string;
  element_type?: string;
  type?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  data?: any;
  z_index?: number;
  zIndex?: number;
}

interface CanvasStore {
  viewport: Viewport;
  canvasContainerSize: { width: number; height: number };
  canvasBounds: { width: number; height: number };
  selectedTool: ToolType;
  canvasElements: CanvasElement[];
  selectedElements: string[];

  // Collaboration state
  collaborators: CollaboratorState[];
  myUserId: string | null;
  elementLocks: ElementLocks;
  myLocks: Set<string>;

  // Viewport actions
  updateViewport: (viewport: Viewport) => void;
  resetViewport: () => void;
  updateCanvasContainerSize: (size: { width: number; height: number }) => void;

  // Tool actions
  setSelectedTool: (tool: ToolType) => void;

  // Element actions
  addElement: (element: Omit<CanvasElement, 'id'>) => string;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  removeElement: (id: string) => void;
  selectElements: (ids: string[]) => void;
  clearSelection: () => void;

  // Collaboration actions
  setCollaborators: (users: CollaboratorState[]) => void;
  updateCollaboratorCursor: (userId: string, cursor: { x: number; y: number }) => void;
  setMyUserId: (userId: string) => void;
  setElementLocks: (locks: ElementLocks) => void;
  setElementLock: (elementId: string, userId: string) => void;
  releaseElementLock: (elementId: string) => void;
  setElements: (elements: ServerElementRow[]) => void;
  addElementFromRemote: (element: ServerElementRow) => void;

  // Collaboration derived helpers
  isElementLockedByOther: (elementId: string) => boolean;
  getElementLockHolder: (elementId: string) => CollaboratorState | undefined;

  // Z-order actions
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Clipboard actions
  clipboardElements: CanvasElement[];
  copyElements: (ids: string[]) => void;
  pasteElements: () => string[];

  // Utility actions
  fitToScreen: () => void;
  getElementById: (id: string) => CanvasElement | undefined;
  getSelectedElements: () => CanvasElement[];
  getViewportCenterPosition: () => { x: number; y: number };
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  canvasContainerSize: { width: 800, height: 600 },
  canvasBounds: computeCanvasBounds([]),
  selectedTool: 'pointer',
  canvasElements: [],
  selectedElements: [],
  clipboardElements: [],

  // Collaboration initial state
  collaborators: [],
  myUserId: null,
  elementLocks: {},
  myLocks: new Set<string>(),

  updateViewport: (viewport) => {
    set({ viewport });
  },

  resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),

  updateCanvasContainerSize: (size) => set({ canvasContainerSize: size }),

  setSelectedTool: (tool) => set({ selectedTool: tool }),

  addElement: (element) => {
    const id = crypto.randomUUID();
    const newElement: CanvasElement = {
      ...element,
      id,
      zIndex: element.zIndex ?? get().canvasElements.length,
    };
    set((state) => {
      const canvasElements = [...state.canvasElements, newElement];
      return { canvasElements, canvasBounds: computeCanvasBounds(canvasElements) };
    });
    return id;
  },

  updateElement: (id, updates) => {
    set((state) => {
      const canvasElements = state.canvasElements.map((element) =>
        element.id === id ? { ...element, ...updates } : element
      );
      return { canvasElements, canvasBounds: computeCanvasBounds(canvasElements) };
    });
  },

  removeElement: (id) => {
    set((state) => {
      const canvasElements = state.canvasElements.filter((element) => element.id !== id);
      return {
        canvasElements,
        selectedElements: state.selectedElements.filter((selectedId) => selectedId !== id),
        canvasBounds: computeCanvasBounds(canvasElements),
      };
    });
  },

  bringForward: (id) => {
    set((state) => {
      // Normalize zIndex to contiguous integers first to prevent collision after non-contiguous ops
      const sorted = [...state.canvasElements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      const normalized = sorted.map((el, i) => ({ ...el, zIndex: i }));
      const idx = normalized.findIndex((el) => el.id === id);
      if (idx === -1 || idx === normalized.length - 1) return state;
      // Swap zIndex with the next element up
      const thisZ = normalized[idx].zIndex;
      const aboveZ = normalized[idx + 1].zIndex;
      const byId: Record<string, number> = {};
      normalized.forEach((el) => { byId[el.id] = el.zIndex; });
      byId[id] = aboveZ;
      byId[normalized[idx + 1].id] = thisZ;
      const canvasElements = state.canvasElements.map((el) => ({ ...el, zIndex: byId[el.id] }));
      return { canvasElements };
    });
  },

  sendBackward: (id) => {
    set((state) => {
      // Normalize zIndex to contiguous integers first to prevent collision after non-contiguous ops
      const sorted = [...state.canvasElements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      const normalized = sorted.map((el, i) => ({ ...el, zIndex: i }));
      const idx = normalized.findIndex((el) => el.id === id);
      if (idx <= 0) return state;
      // Swap zIndex with the next element down
      const thisZ = normalized[idx].zIndex;
      const belowZ = normalized[idx - 1].zIndex;
      const byId: Record<string, number> = {};
      normalized.forEach((el) => { byId[el.id] = el.zIndex; });
      byId[id] = belowZ;
      byId[normalized[idx - 1].id] = thisZ;
      const canvasElements = state.canvasElements.map((el) => ({ ...el, zIndex: byId[el.id] }));
      return { canvasElements };
    });
  },

  bringToFront: (id) => {
    set((state) => {
      if (state.canvasElements.length === 0) return state;
      if (!state.canvasElements.some((el) => el.id === id)) {
        console.warn('[useCanvasStore] bringToFront: element not found', id);
        return state;
      }
      const maxZ = state.canvasElements.reduce((m, el) => Math.max(m, el.zIndex ?? 0), 0);
      const canvasElements = state.canvasElements.map((el) =>
        el.id === id ? { ...el, zIndex: maxZ + 1 } : el
      );
      return { canvasElements };
    });
  },

  sendToBack: (id) => {
    set((state) => {
      if (state.canvasElements.length === 0) return state;
      if (!state.canvasElements.some((el) => el.id === id)) {
        console.warn('[useCanvasStore] sendToBack: element not found', id);
        return state;
      }
      const minZ = state.canvasElements.reduce((m, el) => Math.min(m, el.zIndex ?? 0), 0);
      const canvasElements = state.canvasElements.map((el) =>
        el.id === id ? { ...el, zIndex: minZ - 1 } : el
      );
      return { canvasElements };
    });
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

  // --- Collaboration actions ---

  setCollaborators: (users) => {
    const myId = get().myUserId;
    set({
      collaborators: users
        .filter((u) => u.userId !== myId)
        .map((u) => ({
          ...u,
          // Preserve existing cursor position if server didn't send one
          cursor: u.cursor ?? get().collaborators.find((c) => c.userId === u.userId)?.cursor,
        })),
    });
  },

  updateCollaboratorCursor: (userId, cursor) => {
    set((state) => ({
      collaborators: state.collaborators.map((c) =>
        c.userId === userId ? { ...c, cursor } : c
      ),
    }));
  },

  setMyUserId: (userId) => set({ myUserId: userId }),

  setElementLocks: (locks) => {
    const myId = get().myUserId;
    const myLocks = new Set<string>();
    if (myId) {
      for (const [eid, uid] of Object.entries(locks)) {
        if (uid === myId) myLocks.add(eid);
      }
    }
    set({ elementLocks: locks, myLocks });
  },

  setElementLock: (elementId, userId) => {
    set((state) => {
      const newLocks = { ...state.elementLocks, [elementId]: userId };
      const newMyLocks = new Set(state.myLocks);
      if (userId === state.myUserId) newMyLocks.add(elementId);
      return { elementLocks: newLocks, myLocks: newMyLocks };
    });
  },

  releaseElementLock: (elementId) => {
    set((state) => {
      const { [elementId]: _, ...rest } = state.elementLocks;
      const newMyLocks = new Set(state.myLocks);
      newMyLocks.delete(elementId);
      return { elementLocks: rest, myLocks: newMyLocks };
    });
  },

  setElements: (elements) => {
    // Map DB rows to CanvasElement shape; skip rows with missing geometry to
    // avoid downstream TypeError in ConnectionLines and canvasBounds
    const mapped: CanvasElement[] = elements.flatMap((el) => {
      if (!el.position || !el.size) {
        console.error('[useCanvasStore] Skipping element with missing position/size:', el.id);
        return [];
      }
      return [{
        id: el.id,
        type: (el.element_type ?? el.type) as CanvasElement['type'],
        position: el.position,
        size: el.size,
        data: el.data,
        zIndex: el.z_index ?? el.zIndex ?? 0,
      }];
    });
    set({ canvasElements: mapped, selectedElements: [], canvasBounds: computeCanvasBounds(mapped) });
  },

  addElementFromRemote: (element) => {
    set((state) => {
      // Avoid duplicates
      if (state.canvasElements.some((e) => e.id === element.id)) return state;
      if (!element.position || !element.size) {
        console.error('[useCanvasStore] Ignoring remote element with missing position/size:', element.id);
        return state;
      }
      const mapped: CanvasElement = {
        id: element.id,
        type: (element.element_type ?? element.type) as CanvasElement['type'],
        position: element.position,
        size: element.size,
        data: element.data,
        zIndex: element.z_index ?? element.zIndex ?? state.canvasElements.length,
      };
      const canvasElements = [...state.canvasElements, mapped];
      return { canvasElements, canvasBounds: computeCanvasBounds(canvasElements) };
    });
  },

  isElementLockedByOther: (elementId) => {
    const { elementLocks, myUserId } = get();
    const holder = elementLocks[elementId];
    return !!holder && holder !== myUserId;
  },

  getElementLockHolder: (elementId) => {
    const { elementLocks, collaborators } = get();
    const holderId = elementLocks[elementId];
    if (!holderId) return undefined;
    return collaborators.find((c) => c.userId === holderId);
  },

  copyElements: (ids) => {
    const els = get().canvasElements.filter((el) => ids.includes(el.id));
    const missing = ids.filter((id) => !els.some((el) => el.id === id));
    if (missing.length > 0) {
      console.warn('[useCanvasStore] copyElements: some element IDs not found', missing);
    }
    // Guard: don't overwrite a valid clipboard with an empty result from stale IDs
    if (els.length === 0) return;
    // Deep-clone at copy time so clipboard is a snapshot independent of subsequent mutations
    set({ clipboardElements: els.map((el) => structuredClone(el)) });
  },

  pasteElements: () => {
    const { clipboardElements } = get();
    if (clipboardElements.length === 0) return [];
    const OFFSET = 24;
    const newEls: CanvasElement[] = clipboardElements.map((el) => ({
      ...el,
      id: crypto.randomUUID(),
      position: { x: el.position.x + OFFSET, y: el.position.y + OFFSET },
      // data was already deep-cloned at copy time; clone again so each paste is independent
      data: el.data != null ? structuredClone(el.data) : el.data,
    }));
    const newIds = newEls.map((el) => el.id);
    set((state) => {
      // Use actual max zIndex rather than array length — these diverge after bringToFront/sendToBack
      const maxZ = state.canvasElements.reduce((m, el) => Math.max(m, el.zIndex ?? 0), -1);
      const canvasElements = [
        ...state.canvasElements.map((el) => ({ ...el, selected: false })),
        ...newEls.map((el, i) => ({ ...el, zIndex: maxZ + 1 + i, selected: true })),
      ];
      return { canvasElements, canvasBounds: computeCanvasBounds(canvasElements), selectedElements: newIds };
    });
    return newIds;
  },

  fitToScreen: () => {
    const { canvasElements: els, canvasContainerSize: cSize } = get();
    if (els.length === 0) { set({ viewport: { x: 0, y: 0, zoom: 1 } }); return; }
    if (cSize.width === 0 || cSize.height === 0) {
      console.warn('[useCanvasStore] fitToScreen: container size not yet measured, skipping fit');
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of els) {
      minX = Math.min(minX, el.position.x);
      minY = Math.min(minY, el.position.y);
      maxX = Math.max(maxX, el.position.x + el.size.width);
      maxY = Math.max(maxY, el.position.y + el.size.height);
    }
    const padding = 50;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    // Use the same dynamic minZoom formula as AutoVizAgent so toolbar/keyboard fits match the F-key fit.
    const contentWidth = Math.max(maxX - minX, 1);
    const contentHeight = Math.max(maxY - minY, 1);
    const dynamicMinZoom = Math.max(0.05, Math.min(cSize.width / contentWidth, cSize.height / contentHeight));
    const fitZoom = Math.min(cSize.width / (contentWidth + padding * 2), cSize.height / (contentHeight + padding * 2), 3);
    const targetZoom = Math.max(dynamicMinZoom, fitZoom);
    set({ viewport: { x: -centerX * targetZoom, y: -centerY * targetZoom, zoom: targetZoom } });
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
    const offsetRange = 50;
    const randomOffsetX = (Math.random() - 0.5) * offsetRange;
    const randomOffsetY = (Math.random() - 0.5) * offsetRange;

    return {
      x: -viewport.x / viewport.zoom + randomOffsetX,
      y: -viewport.y / viewport.zoom + randomOffsetY,
    };
  },
}));
