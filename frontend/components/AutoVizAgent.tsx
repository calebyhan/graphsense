'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import InfiniteCanvas from '@/components/canvas/InfiniteCanvas';
import FloatingToolbar from '@/components/canvas/FloatingToolbar';
import { DataPanel } from '@/components/panels/DataPanel';
import { VisualizationPanel } from '@/components/panels/VisualizationPanel';
import { TopNavigation } from '@/components/navigation/TopNavigation';

import { useCanvasStore, ToolType } from '@/store/useCanvasStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { getActiveWebSocket } from '@/lib/realtime/canvasWebSocket';
import { useThemeTransition } from '@/hooks/useThemeTransition';
import { useDatasetManager } from '@/hooks/useDatasetManager';
import { RecommendationProcessor } from '@/lib/services/recommendationProcessor';
import CanvasElement from '@/components/canvas/CanvasElement';
import ChartCard from '@/components/canvas/elements/ChartCard';
import DatasetCard from '@/components/canvas/elements/DatasetCard';
import MapCard from '@/components/canvas/elements/MapCard';
import TextCard from '@/components/canvas/elements/TextCard';
import TableCard from '@/components/canvas/elements/TableCard';
import NoteCard from '@/components/canvas/elements/NoteCard';
import ConnectionLines from '@/components/canvas/ConnectionLines';
import ContextMenu, { ContextMenuState } from '@/components/canvas/ContextMenu';
import { canvasAPI } from '@/lib/api/backendClient';
import { useAuth } from '@/hooks/useAuth';
import { ChartExportService } from '@/lib/services/chartExport';

export interface Dataset {
  id: string;
  name: string;
  type: 'csv' | 'json' | 'excel' | 'api';
  size: string;
  columns: number;
  rows: number;
  dataTypes: {
    numerical: number;
    categorical: number;
    temporal: number;
    geographic: number;
  };
  preview: string[];
  lastModified: string;
  data?: any[];
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface Visualization {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'column' | 'pie' | 'scatter' | 'area' | 'heatmap' | 'histogram' | 'box_plot' | 'treemap' | 'sankey';
  dataSource: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any;
  config?: any;
  confidence?: number;
  reasoning?: string;
}

/** Raw recommendation from the backend API, before client-side processing.
 * For processed, render-ready recommendations, use ChartRecommendation from @/lib/types. */
export interface RawRecommendation {
  id: string;
  type: 'line' | 'bar' | 'column' | 'pie' | 'scatter' | 'area' | 'heatmap' | 'histogram' | 'box_plot' | 'treemap' | 'sankey';
  chartType?: 'line' | 'bar' | 'column' | 'pie' | 'scatter' | 'area' | 'heatmap' | 'histogram' | 'box_plot' | 'treemap' | 'sankey';
  name: string;
  confidence: number;
  reasoning: string;
  justification?: string;
  description: string;
  bestFor: string[];
  config?: any;
}

const PLACEMENT_GAP = 24; // px gap between elements in world coordinates

/**
 * Find a position near `preferred` that does not overlap any existing canvas element.
 * Tries a grid of offsets spiraling outward; falls back to a cascading diagonal offset.
 */
function findFreePosition(
  preferred: { x: number; y: number },
  size: { width: number; height: number },
  existingElements: Array<{ position: { x: number; y: number }; size: { width: number; height: number } }>
): { x: number; y: number } {
  const overlaps = (pos: { x: number; y: number }) =>
    existingElements.some((el) => {
      const ax1 = pos.x, ay1 = pos.y, ax2 = pos.x + size.width, ay2 = pos.y + size.height;
      const bx1 = el.position.x, by1 = el.position.y, bx2 = el.position.x + el.size.width, by2 = el.position.y + el.size.height;
      return ax1 < bx2 + PLACEMENT_GAP && ax2 > bx1 - PLACEMENT_GAP && ay1 < by2 + PLACEMENT_GAP && ay2 > by1 - PLACEMENT_GAP;
    });

  if (!overlaps(preferred)) return preferred;

  // Spiral outward in steps matching element dimensions
  const stepX = size.width + PLACEMENT_GAP;
  const stepY = size.height + PLACEMENT_GAP;
  for (let ring = 1; ring <= 8; ring++) {
    const candidates = [
      { x: preferred.x + ring * stepX, y: preferred.y },
      { x: preferred.x - ring * stepX, y: preferred.y },
      { x: preferred.x, y: preferred.y + ring * stepY },
      { x: preferred.x, y: preferred.y - ring * stepY },
      { x: preferred.x + ring * stepX, y: preferred.y + ring * stepY },
      { x: preferred.x - ring * stepX, y: preferred.y + ring * stepY },
      { x: preferred.x + ring * stepX, y: preferred.y - ring * stepY },
      { x: preferred.x - ring * stepX, y: preferred.y - ring * stepY },
    ];
    const free = candidates.find((c) => !overlaps(c));
    if (free) return free;
  }

  // Last resort: cascade diagonally
  return {
    x: preferred.x + existingElements.length * (size.width / 4 + PLACEMENT_GAP),
    y: preferred.y + existingElements.length * (size.height / 4 + PLACEMENT_GAP),
  };
}

/** Return a natural initial size for a canvas element based on type + available metadata.
 * @param opts.rows - For 'dataset'/'table', the number of rows to size for; callers should
 *   cap this (typically ≤ 10) to avoid oversized initial elements.
 */
function getDefaultSize(
  type: 'chart' | 'dataset' | 'table' | 'map' | 'text' | 'note',
  opts: { chartType?: string; columns?: number; rows?: number } = {}
): { width: number; height: number } {
  const { chartType, columns = 0, rows = 0 } = opts;
  switch (type) {
    case 'chart': {
      // Add ~130px to all heights to account for fixed UI overhead:
      // header (~52px) + confidence/justification box (~78px) = ~130px.
      // This ensures the chart rendering area has room for both axes and labels.
      switch (chartType) {
        // No axes — fill the container, square-ish
        case 'pie':      return { width: 400, height: 480 };
        case 'treemap':  return { width: 540, height: 520 };
        // Two labeled axes — need generous width + height so labels aren't clipped
        case 'scatter':  return { width: 560, height: 560 }; // symmetric axes
        case 'heatmap':  return { width: 600, height: 600 }; // many ticks on both axes
        case 'box_plot': return { width: 580, height: 540 };
        case 'histogram':return { width: 580, height: 520 };
        // Flow / layout charts — wide
        case 'sankey':   return { width: 700, height: 520 };
        // Standard x/y charts — wide enough for tick labels + legend
        default:         return { width: 600, height: 500 }; // bar, line, area
      }
    }
    case 'dataset': {
      const w = Math.min(Math.max(320, columns * 110), 680);
      const h = Math.min(Math.max(220, rows * 26 + 80), 480);
      return { width: w, height: h };
    }
    case 'table': {
      const w = Math.min(Math.max(360, columns * 130), 820);
      const h = Math.min(Math.max(220, rows * 34 + 70), 520);
      return { width: w, height: h };
    }
    case 'map':  return { width: 520, height: 400 };
    case 'text': return { width: 280, height: 140 };
    case 'note': return { width: 220, height: 160 };
    default:
      throw new Error(`getDefaultSize: unhandled element type "${type}"`);
  }
}

export default function AutoVizAgent({ readOnly = false, emitCursor, canvasId, isOwner }: { readOnly?: boolean; emitCursor?: (x: number, y: number) => void; canvasId?: string; isOwner?: boolean }) {
  // State management
  const [_visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [selectedVizId, setSelectedVizId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<RawRecommendation[]>([]);
  
  // Dataset management with React Query — scoped to canvas when canvasId is present
  const { datasets } = useDatasetManager({ canvasId });

  // Canvas state — use selectors to avoid re-renders from unrelated store updates (e.g. cursor moves)
  const viewport = useCanvasStore(s => s.viewport);
  const canvasElements = useCanvasStore(s => s.canvasElements);
  const canvasBounds = useCanvasStore(s => s.canvasBounds);
  const canvasContainerSize = useCanvasStore(s => s.canvasContainerSize);
  const selectedTool = useCanvasStore(s => s.selectedTool);
  const setSelectedTool = useCanvasStore(s => s.setSelectedTool);
  const addElement = useCanvasStore(s => s.addElement);
  const updateViewport = useCanvasStore(s => s.updateViewport);
  const storeSelectedElements = useCanvasStore(s => s.selectedElements);
  const hasClipboard = useCanvasStore(s => s.clipboardElements.length > 0);

  // Sync selectedVizId with store selection. Clear it when the store no longer includes it
  // (covers both rubber-band deselect and rubber-band switching to a different element set).
  useEffect(() => {
    if (selectedVizId !== null && !storeSelectedElements.includes(selectedVizId)) {
      setSelectedVizId(null);
    }
  }, [storeSelectedElements, selectedVizId]);
  const { rawData, dataProfile, recommendations: storeRecommendations, agentStates, isLoading, startAnalysis } = useAnalysisStore();

  // Theme transition hook
  const { isDarkMode, isTransitioning, toggleTheme } = useThemeTransition();

  const { session } = useAuth();
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);
  // Captures the server-loaded layout so we don't auto-save on async element population
  const baselineLayoutKeyRef = useRef<string | null>(null);
  const hasFitOnLoadRef = useRef(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false });
  const [isExporting, setIsExporting] = useState(false);
  const exportCanvasContainerRef = useRef<HTMLDivElement>(null);

  // Reset autosave state when canvasId changes (e.g. navigation without full remount)
  useEffect(() => {
    if (thumbnailTimerRef.current) { clearTimeout(thumbnailTimerRef.current); thumbnailTimerRef.current = null; }
    initialLoadRef.current = true;
    baselineLayoutKeyRef.current = null;
    hasFitOnLoadRef.current = false;
    setSaveState('idle');
    setLastSaved(null);
  }, [canvasId]);

  // Fit-to-screen on initial load once elements and container size are both known
  useEffect(() => {
    if (hasFitOnLoadRef.current) return;
    if (canvasElements.length === 0) return;
    const { width: cW, height: cH } = canvasContainerSize;
    if (cW === 0 || cH === 0) return;

    hasFitOnLoadRef.current = true;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of canvasElements) {
      minX = Math.min(minX, el.position.x);
      minY = Math.min(minY, el.position.y);
      maxX = Math.max(maxX, el.position.x + el.size.width);
      maxY = Math.max(maxY, el.position.y + el.size.height);
    }
    const padding = 80;
    const boundingWidth = maxX - minX + padding * 2;
    const boundingHeight = maxY - minY + padding * 2;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const fitZoom = Math.min(cW / boundingWidth, cH / boundingHeight, 2);
    const targetZoom = Math.max(0.1, fitZoom);
    updateViewport({ x: -centerX * targetZoom, y: -centerY * targetZoom, zoom: targetZoom });
  }, [canvasElements, canvasContainerSize, updateViewport]);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Dynamic canvas size — sourced from store (kept in sync by element-modifying actions).
  const canvasDimensions = canvasBounds;

  // Minimum zoom: fit the entire canvas within the actual container area tracked by InfiniteCanvas's ResizeObserver.
  const minZoom = useMemo(() => {
    const { width: cW, height: cH } = canvasContainerSize;
    // Math.min → "contain": show the entire canvas at min zoom (letterbox if needed)
    return Math.max(0.05, Math.min(cW / canvasDimensions.width, cH / canvasDimensions.height));
  }, [canvasDimensions, canvasContainerSize]);

  // Stable key derived only from layout-relevant fields — ignores selection, data, zIndex changes
  const elementLayoutKey = useMemo(
    () => canvasElements
      .map(el => `${el.id}|${el.type}|${el.position.x}|${el.position.y}|${el.size.width}|${el.size.height}`)
      .join(','),
    [canvasElements]
  );
  // Keep a ref so the timeout closure always reads the latest elements without being a dependency
  const canvasElementsRef = useRef(canvasElements);
  useEffect(() => { canvasElementsRef.current = canvasElements; }, [canvasElements]);

  // Auto-save thumbnail when layout changes (debounced 3s, when canvas is editable)
  useEffect(() => {
    if (!canvasId || readOnly) return;
    // First run after mount: set baseline to '' for empty canvases so the first user
    // edit can save; for non-empty canvases leave baseline null so the async server
    // load (next effect run) is captured as baseline instead.
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      if (elementLayoutKey === '') baselineLayoutKeyRef.current = '';
      return;
    }
    // Capture the first post-mount layout (server-loaded elements) as baseline
    if (baselineLayoutKeyRef.current === null) {
      baselineLayoutKeyRef.current = elementLayoutKey;
      return;
    }
    // Don't save if nothing has changed from the server-loaded state
    if (elementLayoutKey === baselineLayoutKeyRef.current) return;
    if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
    setSaveState('saving');
    let cancelled = false;
    thumbnailTimerRef.current = setTimeout(async () => {
      const els = canvasElementsRef.current;
      if (!els.length) {
        try {
          await canvasAPI.update(canvasId, { thumbnail: null }, session?.access_token);
          if (!cancelled) { baselineLayoutKeyRef.current = elementLayoutKey; setLastSaved(new Date()); setSaveState('saved'); }
        } catch (err) {
          console.error('[AutoVizAgent] Failed to save canvas (empty):', err);
          if (!cancelled) setSaveState('idle');
        }
        return;
      }
      let minX = els[0].position.x, minY = els[0].position.y;
      let maxX = els[0].position.x + els[0].size.width, maxY = els[0].position.y + els[0].size.height;
      for (let i = 1; i < els.length; i++) {
        const el = els[i];
        if (el.position.x < minX) minX = el.position.x;
        if (el.position.y < minY) minY = el.position.y;
        const x2 = el.position.x + el.size.width;
        const y2 = el.position.y + el.size.height;
        if (x2 > maxX) maxX = x2;
        if (y2 > maxY) maxY = y2;
      }
      const bounds = { minX, minY, maxX, maxY };
      const MAX_THUMBNAIL_ELEMENTS = 200;
      const thumbnailEls = els.length > MAX_THUMBNAIL_ELEMENTS ? els.slice(0, MAX_THUMBNAIL_ELEMENTS) : els;
      const elements = thumbnailEls.map(el => ({
        type: el.type,
        x: el.position.x,
        y: el.position.y,
        w: el.size.width,
        h: el.size.height,
      }));
      try {
        await canvasAPI.update(canvasId, { thumbnail: { elements, bounds } }, session?.access_token);
        if (!cancelled) { baselineLayoutKeyRef.current = elementLayoutKey; setLastSaved(new Date()); setSaveState('saved'); }
      } catch (err) {
        console.error('[AutoVizAgent] Failed to save canvas thumbnail:', err);
        if (!cancelled) setSaveState('idle');
      }
    }, 3000);
    return () => {
      cancelled = true;
      if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
    };
  }, [elementLayoutKey, canvasId, readOnly, session?.access_token]);

  // Sync recommendations from store and process them with our new system
  React.useEffect(() => {
    if (storeRecommendations && storeRecommendations.length > 0 && rawData) {
      let processedRecommendations;
      try {
        processedRecommendations = RecommendationProcessor.processRecommendations(
          storeRecommendations,
          rawData,
          dataProfile
        );
      } catch (err) {
        console.error('[AutoVizAgent] processRecommendations failed:', err);
        setRecommendations([]);
        return;
      }

      const formattedRecommendations = processedRecommendations.map((rec, index) => ({
        id: `rec-${index}`,
        type: rec.chartType,
        chartType: rec.chartType,
        name: rec.chartType.charAt(0).toUpperCase() + rec.chartType.slice(1),
        confidence: rec.confidence,
        reasoning: rec.justification,
        justification: rec.justification,
        description: `Shows data using ${rec.chartType} format`,
        bestFor: ['Data visualization'],
        config: rec.config
      }));

      setRecommendations(formattedRecommendations);
    } else if (storeRecommendations && storeRecommendations.length > 0 && !rawData) {
      console.warn('Recommendations available but no raw data for processing');
    }
  }, [storeRecommendations, rawData, dataProfile]);

  // Sync analysis state
  React.useEffect(() => {
    setIsAnalyzing(isLoading);
  }, [isLoading]);

  // Auto-select dataset when analysis data is available (only if no manual selection)
  React.useEffect(() => {
    // Only auto-select if no dataset is already selected and we have raw data
    if (rawData && !selectedDataset && datasets.length > 0) {
      const matchingDataset = datasets.find((d: Dataset) => {
        if (!d.data || !rawData) return false;

        // Compare data length and structure
        if (d.data.length !== rawData.length) return false;

        // Compare first row keys to ensure same structure
        if (d.data.length > 0 && rawData.length > 0) {
          const existingKeys = Object.keys(d.data[0] || {}).sort();
          const newKeys = Object.keys(rawData[0] || {}).sort();
          return JSON.stringify(existingKeys) === JSON.stringify(newKeys);
        }

        return true;
      });

      if (matchingDataset) {
        setSelectedDataset(matchingDataset);
        // Note: Don't start analysis here - let the selection effect handle it
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, selectedDataset, datasets]);

  // Handle dataset selection from DataPanel
  const handleDatasetSelect = useCallback(async (dataset: Dataset) => {
    setSelectedDataset(dataset);

    if (dataset.data && dataset.data.length > 0) {
      startAnalysis(dataset.data, dataset.name, dataset.id);
    } else {
      console.warn('Selected dataset has no data:', dataset.name);
    }

    // Canvas mutations are not allowed in read-only mode
    if (readOnly) return;

    // Auto-add a dataset card the first time this dataset appears on the canvas
    const alreadyOnCanvas = useCanvasStore
      .getState()
      .canvasElements.some(
        (el) => el.type === 'dataset' && el.data?.datasetId === dataset.id
      );
    if (!alreadyOnCanvas) {
      const center = useCanvasStore.getState().getViewportCenterPosition();
      const dsSize = getDefaultSize('dataset', { columns: dataset.columns, rows: Math.min(dataset.rows, 10) });
      const dsPreferred = { x: center.x - dsSize.width / 2, y: center.y - dsSize.height / 2 };
      const dsPosition = findFreePosition(dsPreferred, dsSize, useCanvasStore.getState().canvasElements);
      const newId = addElement({
        type: 'dataset',
        position: dsPosition,
        size: dsSize,
        data: {
          datasetId: dataset.id,
          // Rows are intentionally omitted here: DatasetCard hydrates from useDatasetManager
          // at render time, so storing full rows in the element avoids large WS commit payloads
          // on every drag/resize.
          title: dataset.name,
        },
      });
      const justAdded = useCanvasStore.getState().canvasElements.find((el) => el.id === newId);
      if (justAdded) {
        const { data: _data, ...rest } = justAdded;
        getActiveWebSocket()?.sendElementAdd({ ...rest, data: { datasetId: dataset.id, title: dataset.name } });
      }
    }
  }, [startAnalysis, addElement, readOnly]); // readOnly must be in deps — guard inside closes over it

  const createVisualization = useCallback((
    dataset: Dataset,
    position: { x: number; y: number },
    type: Visualization['type'] = 'bar',
    recommendation?: RawRecommendation
  ) => {
    // Create visualization for local state tracking
    const chartSize = getDefaultSize('chart', { chartType: type });
    const newViz: Visualization = {
      id: `viz-${Date.now()}`,
      title: type ? `${type.charAt(0).toUpperCase() + type.slice(1)} Chart` : 'Chart',
      type,
      dataSource: dataset.name,
      position,
      size: chartSize,
      confidence: recommendation?.confidence,
      reasoning: recommendation?.reasoning,
      config: recommendation?.config
    };

    // Add to local state for backward compatibility and selection tracking
    setVisualizations(prev => [...prev, newViz]);
    setSelectedVizId(newViz.id);

    // Create chart title
    const chartTitle = recommendation?.config?.title ||
                      (recommendation?.config?.xAxis && recommendation?.config?.yAxis ?
                        `${recommendation.config.yAxis} vs ${recommendation.config.xAxis}` : null) ||
                      `${type} Visualization`;

    const canvasElement = {
      type: 'chart' as const,
      position,
      size: chartSize,
      data: {
        config: {
          ...recommendation?.config,
          title: chartTitle
        },
        chartType: type,
        recommendation: recommendation,
        title: chartTitle,
        // dataset object intentionally excluded — sourceDatasetId is sufficient for lookups
        // and omitting raw rows keeps sendElementCommit payloads small on drag/resize.
        sourceDatasetId: dataset.id,
      }
    };

    const newElementId = addElement(canvasElement);

    // Broadcast new element to collaborators
    const store = useCanvasStore.getState();
    const justAdded = store.canvasElements.find((el) => el.id === newElementId);
    if (justAdded) {
      getActiveWebSocket()?.sendElementAdd(justAdded);
    }
  }, [addElement]);

  // Handle drag & drop from DataPanel to Canvas
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!selectedDataset) return;
    // e.currentTarget is the InfiniteCanvas container (viewport div), so rect gives correct dimensions
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasX = (screenX - rect.width / 2 - viewport.x) / viewport.zoom;
    const canvasY = (screenY - rect.height / 2 - viewport.y) / viewport.zoom;
    const sz = getDefaultSize('chart');
    createVisualization(selectedDataset, { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 });
  }, [selectedDataset, viewport, createVisualization]);

  // Create visualization from recommendation
  const createVisualizationFromRecommendation = useCallback((
    recommendation: RawRecommendation
  ) => {
    if (!selectedDataset) return;

    const centerPosition = useCanvasStore.getState().getViewportCenterPosition();
    const sz = getDefaultSize('chart', { chartType: recommendation.type });
    const preferred = { x: centerPosition.x - sz.width / 2, y: centerPosition.y - sz.height / 2 };
    const existing = useCanvasStore.getState().canvasElements;
    const position = findFreePosition(preferred, sz, existing);

    createVisualization(
      selectedDataset,
      position,
      recommendation.type,
      recommendation
    );
  }, [selectedDataset, createVisualization]);

  // Auto-Viz function
  const handleAutoViz = useCallback(async () => {
    if (!selectedDataset || recommendations.length === 0) return;

    // Create the top recommendation automatically
    const topRecommendation = recommendations[0];
    createVisualizationFromRecommendation(topRecommendation);
  }, [selectedDataset, recommendations, createVisualizationFromRecommendation]);

  // Visualization management - now sync with canvas store
  const handleVisualizationSelect = useCallback((id: string) => {
    setSelectedVizId(id);
  }, []);

  const handleVisualizationDelete = useCallback((id: string) => {
    // Broadcast removal to collaborators
    getActiveWebSocket()?.sendElementRemove(id);

    // Remove from canvas store
    const { removeElement } = useCanvasStore.getState();
    removeElement(id);

    // Remove from local state
    setVisualizations(prev => prev.filter(viz => viz.id !== id));
    if (selectedVizId === id) {
      setSelectedVizId(null);
    }
  }, [selectedVizId]);

  const handleDeleteSelected = useCallback(() => {
    const { selectedElements } = useCanvasStore.getState();
    if (selectedElements.length > 0) {
      selectedElements.forEach(id => handleVisualizationDelete(id));
    } else if (selectedVizId) {
      handleVisualizationDelete(selectedVizId);
    }
  }, [selectedVizId, handleVisualizationDelete]);

  // Add a non-chart element at a given canvas position and switch back to pointer
  const handleAddElement = useCallback((
    type: 'text' | 'table' | 'map' | 'note',
    position: { x: number; y: number },
    size: { width: number; height: number }
  ) => {
    if (readOnly) return;
    const data: Record<string, any> = {};
    if ((type === 'table' || type === 'map') && selectedDataset) {
      // Store only a bounded preview + metadata — not the full rows — to keep WS payloads small
      data.data = (selectedDataset.data || []).slice(0, 100);
      data.title = selectedDataset.name;
      data.sourceDatasetId = selectedDataset.id;
    }
    const newId = addElement({ type, position, size, data });
    const justAdded = useCanvasStore.getState().canvasElements.find(el => el.id === newId);
    if (justAdded) {
      // data.data is already bounded to 100 rows (set above), safe to send as-is
      getActiveWebSocket()?.sendElementAdd(justAdded);
    }
    setSelectedTool('pointer');
  }, [readOnly, selectedDataset, addElement, setSelectedTool]);

  const handleFitToScreen = useCallback(() => useCanvasStore.getState().fitToScreen(), []);

  const handleExportElement = useCallback(async (elementId: string) => {
    const node = document.querySelector<HTMLElement>(`[data-element-id="${elementId}"]`);
    if (!node) return;
    // Prefer the chart-card inside the element (skips the CanvasElement UI header).
    // Fall back to the full element node for non-chart element types.
    const target = node.querySelector<HTMLElement>('.chart-card') ?? node;
    try {
      await ChartExportService.exportChart(target, 'png', {
        filename: `element_${new Date().toISOString().split('T')[0]}`,
        backgroundColor: '#ffffff',
      });
    } catch (err) {
      console.error('[AutoVizAgent] Element export failed:', err);
    }
  }, []);

  const handleExportCanvas = useCallback(async (format: 'png' | 'pdf') => {
    if (!exportCanvasContainerRef.current || canvasElements.length === 0) return;
    setIsExporting(true);
    try {
      await ChartExportService.exportFullCanvas(
        exportCanvasContainerRef.current,
        canvasElements,
        format,
        { filename: `canvas_${new Date().toISOString().split('T')[0]}` }
      );
    } catch (err) {
      console.error('[AutoVizAgent] Canvas export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [canvasElements]);

  // Duplicate an element with a +20px offset
  const handleDuplicateElement = useCallback((id: string) => {
    if (readOnly) return;
    const el = useCanvasStore.getState().canvasElements.find(e => e.id === id);
    if (!el) {
      console.error('[AutoVizAgent] handleDuplicateElement: element not found in store', { id });
      return;
    }
    // Destructure id and zIndex out — addElement assigns a fresh zIndex so the duplicate doesn't
    // share the same stacking value as the original (which would cause non-deterministic CSS ordering).
    const { id: _oldId, zIndex: _oldZIndex, selected: _oldSelected, ...elWithoutIdAndZ } = el;
    const newId = addElement({ ...elWithoutIdAndZ, selected: false, position: { x: el.position.x + 20, y: el.position.y + 20 } });
    const justAdded = useCanvasStore.getState().canvasElements.find(e => e.id === newId);
    if (!justAdded) {
      console.error('[AutoVizAgent] handleDuplicateElement: newly-added element missing from store', { newId });
      return;
    }
    getActiveWebSocket()?.sendElementAdd(justAdded);
  }, [readOnly, addElement]);

  const handleCopyElements = useCallback((targetId?: string) => {
    if (readOnly) return;
    // Prefer the explicitly targeted element (right-click on unselected item); fall back to selection
    const ids = targetId ? [targetId] : useCanvasStore.getState().selectedElements;
    if (ids.length > 0) useCanvasStore.getState().copyElements(ids);
  }, [readOnly]);

  const handlePasteElements = useCallback(() => {
    if (readOnly) return;
    const newIds = useCanvasStore.getState().pasteElements();
    if (newIds.length === 0) return;
    const { canvasElements } = useCanvasStore.getState();
    newIds.forEach((id) => {
      const el = canvasElements.find((e) => e.id === id);
      if (!el) {
        console.error('[AutoVizAgent] handlePasteElements: pasted element missing from store', { id });
        return;
      }
      getActiveWebSocket()?.sendElementAdd(el);
    });
  }, [readOnly]);

  // Context menu: canvas background right-click
  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const vp = useCanvasStore.getState().viewport;
    const canvasX = (e.clientX - rect.left - rect.width / 2 - vp.x) / vp.zoom;
    const canvasY = (e.clientY - rect.top - rect.height / 2 - vp.y) / vp.zoom;
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, elementId: null, canvasX, canvasY });
  }, [readOnly]);

  // Context menu: element right-click
  const handleElementContextMenu = useCallback((e: React.MouseEvent, elementId: string) => {
    if (readOnly) return;
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, elementId });
  }, [readOnly]);

  // Place an element from the context menu at given canvas coords
  const handleContextMenuPlace = useCallback((tool: ToolType, canvasX: number, canvasY: number) => {
    if (readOnly) return;
    if (tool === 'chart') {
      if (selectedDataset) {
        const sz = getDefaultSize('chart');
        createVisualization(selectedDataset, { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 });
      }
      return;
    }
    if (tool === 'dataset') {
      if (selectedDataset) {
        const sz = getDefaultSize('dataset', { columns: selectedDataset.columns, rows: Math.min(selectedDataset.rows, 10) });
        const dsId = addElement({ type: 'dataset', position: { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 }, size: sz, data: { datasetId: selectedDataset.id, title: selectedDataset.name } });
        const dsAdded = useCanvasStore.getState().canvasElements.find(el => el.id === dsId);
        if (dsAdded) getActiveWebSocket()?.sendElementAdd(dsAdded);
      }
      return;
    }
    if (tool === 'text' || tool === 'table' || tool === 'map' || tool === 'note') {
      const sz = tool === 'table'
        ? getDefaultSize('table', { columns: selectedDataset?.columns ?? 4, rows: selectedDataset ? Math.min(selectedDataset.rows, 10) : 8 })
        : getDefaultSize(tool);
      handleAddElement(tool, { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 }, sz);
    }
  }, [readOnly, selectedDataset, createVisualization, addElement, handleAddElement]);

  // Prepare visualization positions for MiniMap - use canvas elements
  const visualizationPositions = canvasElements
    .filter(element => element.type === 'chart')
    .map(element => ({
      id: element.id,
      x: element.position.x,
      y: element.position.y,
      width: element.size.width,
      height: element.size.height
    }));

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-900 prevent-zoom">
      {/* Top Navigation */}
      <TopNavigation
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleTheme}
        isTransitioning={isTransitioning}
        canvasId={canvasId}
        isOwner={isOwner}
        saveState={saveState}
        lastSaved={lastSaved}
        onExportCanvas={canvasElements.length > 0 ? handleExportCanvas : undefined}
        isExporting={isExporting}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Data Panel - Left Sidebar */}
        <div className="flex flex-col">
          <DataPanel
            selectedDataset={selectedDataset}
            onDatasetSelect={handleDatasetSelect}
            canvasId={canvasId}
          />
        </div>

        {/* Canvas Area - Center */}
        <div ref={exportCanvasContainerRef} className="flex-1 relative overflow-hidden">
          <InfiniteCanvas
            onCursorMove={emitCursor}
            minZoom={minZoom}
            canvasSize={canvasDimensions}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onContextMenu={handleCanvasContextMenu}
            onCanvasClick={(e) => {
              // Deselect on canvas background click (not during pan/drag)
              if (selectedTool !== 'drag') setSelectedVizId(null);

              const rect = e.currentTarget.getBoundingClientRect();
              const screenX = e.clientX - rect.left;
              const screenY = e.clientY - rect.top;
              const canvasX = (screenX - rect.width / 2 - viewport.x) / viewport.zoom;
              const canvasY = (screenY - rect.height / 2 - viewport.y) / viewport.zoom;

              if (readOnly) return;

              if (e.detail === 2 && selectedTool === 'pointer') {
                // Double-click in pointer mode to add a chart when a dataset is selected
                if (selectedDataset) {
                  const sz = getDefaultSize('chart');
                  createVisualization(selectedDataset, { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 });
                }
              } else if (e.detail === 1) {
                // Single-click placement for active placement tools
                if (selectedTool === 'chart' && selectedDataset) {
                  const sz = getDefaultSize('chart');
                  createVisualization(selectedDataset, { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 });
                  setSelectedTool('pointer');
                } else if (selectedTool === 'dataset' && selectedDataset) {
                  const sz = getDefaultSize('dataset', { columns: selectedDataset.columns, rows: Math.min(selectedDataset.rows, 10) });
                  const dsId = addElement({ type: 'dataset', position: { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 }, size: sz, data: { datasetId: selectedDataset.id, title: selectedDataset.name } });
                  const dsAdded = useCanvasStore.getState().canvasElements.find(el => el.id === dsId);
                  if (dsAdded) getActiveWebSocket()?.sendElementAdd(dsAdded);
                  setSelectedTool('pointer');
                } else if (selectedTool === 'text') {
                  const sz = getDefaultSize('text');
                  handleAddElement('text', { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 }, sz);
                } else if (selectedTool === 'table') {
                  const cols = selectedDataset?.columns ?? 4;
                  const rows = selectedDataset ? Math.min(selectedDataset.rows, 10) : 8;
                  const sz = getDefaultSize('table', { columns: cols, rows });
                  handleAddElement('table', { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 }, sz);
                } else if (selectedTool === 'map') {
                  const sz = getDefaultSize('map');
                  handleAddElement('map', { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 }, sz);
                } else if (selectedTool === 'note') {
                  const sz = getDefaultSize('note');
                  handleAddElement('note', { x: canvasX - sz.width / 2, y: canvasY - sz.height / 2 }, sz);
                }
              }
            }}
          >
            <div
              ref={canvasRef}
              style={{ width: canvasDimensions.width, height: canvasDimensions.height, position: 'relative' }}
            >
              <ConnectionLines
                canvasWidth={canvasDimensions.width}
                canvasHeight={canvasDimensions.height}
              />
              {canvasElements.map((element) => (
                <CanvasElement
                  key={element.id}
                  element={element}
                  isSelected={selectedVizId === element.id}
                  onSelect={() => handleVisualizationSelect(element.id)}
                  onDelete={readOnly ? undefined : () => handleVisualizationDelete(element.id)}
                  onContextMenu={readOnly ? undefined : handleElementContextMenu}
                >
                  {element.type === 'chart' && (
                    <ChartCard
                      config={element.data?.config}
                      chartType={element.data?.chartType || 'bar'}
                      recommendation={element.data?.recommendation}
                      title={element.data?.title}
                    />
                  )}
                  {element.type === 'dataset' && (() => {
                    // Remote clients receive dataset elements without row data (WS payload strips rows).
                    // Fall back to the locally loaded dataset list so both clients see the same table.
                    const hydrated = element.data?.data?.length
                      ? element.data.data
                      : datasets.find((d: Dataset) => d.id === element.data?.datasetId)?.data || [];
                    return (
                      <DatasetCard
                        data={hydrated}
                        dataProfile={element.data?.dataProfile}
                        title={element.data?.title || 'Dataset'}
                      />
                    );
                  })()}
                  {element.type === 'map' && (
                    <MapCard
                      data={element.data?.data || []}
                      title={element.data?.title || 'Map'}
                      config={element.data?.config}
                    />
                  )}
                  {element.type === 'table' && (
                    <TableCard
                      data={element.data?.data || []}
                      title={element.data?.title || 'Table'}
                    />
                  )}
                  {element.type === 'text' && (
                    <TextCard
                      initialContent={element.data?.content || ''}
                      title={element.data?.title || 'Text'}
                      editable={!readOnly}
                      onUpdate={(content) => {
                        const newData = { ...element.data, content };
                        useCanvasStore.getState().updateElement(element.id, { data: newData });
                        getActiveWebSocket()?.sendElementUpdate(element.id, { data: newData });
                      }}
                    />
                  )}
                  {element.type === 'note' && (
                    <NoteCard
                      initialContent={element.data?.content || ''}
                      color={element.data?.color}
                      editable={!readOnly}
                      onUpdate={(content, color) => {
                        const newData = { ...element.data, content, color };
                        useCanvasStore.getState().updateElement(element.id, { data: newData });
                        getActiveWebSocket()?.sendElementUpdate(element.id, { data: newData });
                      }}
                    />
                  )}
                </CanvasElement>
              ))}
            </div>
          </InfiniteCanvas>

          {/* Context Menu */}
          {!readOnly && (
            <ContextMenu
              state={contextMenu}
              onClose={() => setContextMenu({ visible: false })}
              onDeleteElement={handleVisualizationDelete}
              onDuplicateElement={handleDuplicateElement}
              onCopyElements={handleCopyElements}
              onPasteElements={handlePasteElements}
              hasClipboard={hasClipboard}
              onPlaceElement={handleContextMenuPlace}
              onFitToScreen={handleFitToScreen}
              onExportElement={handleExportElement}
            />
          )}

          {/* Floating Toolbar — hidden in read-only mode */}
          {!readOnly && (
            <FloatingToolbar
              onAddVisualization={handleAutoViz}
              onDeleteSelected={handleDeleteSelected}
              hasSelection={selectedVizId !== null}
              onExportCanvas={canvasElements.length > 0 ? handleExportCanvas : undefined}
              isExporting={isExporting}
            />
          )}


        </div>

        {/* Visualization Panel - Right Sidebar — hidden in read-only mode */}
        {!readOnly && (
          <VisualizationPanel
            selectedDataset={selectedDataset}
            recommendations={recommendations}
            isAnalyzing={isAnalyzing}
            onCreateVisualization={createVisualizationFromRecommendation}
            onAutoViz={handleAutoViz}
            visualizationPositions={visualizationPositions}
          />
        )}
      </div>
    </div>
  );
}
