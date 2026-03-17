'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import InfiniteCanvas from '@/components/canvas/InfiniteCanvas';
import FloatingToolbar from '@/components/canvas/FloatingToolbar';
import { DataPanel } from '@/components/panels/DataPanel';
import { VisualizationPanel } from '@/components/panels/VisualizationPanel';
import { TopNavigation } from '@/components/navigation/TopNavigation';

import { useCanvasStore } from '@/store/useCanvasStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { getActiveWebSocket } from '@/lib/realtime/canvasWebSocket';
import { useThemeTransition } from '@/hooks/useThemeTransition';
import { useDatasetManager } from '@/hooks/useDatasetManager';
import { RecommendationProcessor } from '@/lib/services/recommendationProcessor';
import CanvasElement from '@/components/canvas/CanvasElement';
import ChartCard from '@/components/canvas/elements/ChartCard';
import DatasetCard from '@/components/canvas/elements/DatasetCard';
import MapCard from '@/components/canvas/elements/MapCard';
import { canvasAPI } from '@/lib/api/backendClient';
import { useAuth } from '@/hooks/useAuth';

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
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'heatmap' | 'histogram' | 'box_plot' | 'treemap' | 'sankey';
  dataSource: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any;
  config?: any;
  confidence?: number;
  reasoning?: string;
}

export interface ChartRecommendation {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'heatmap' | 'histogram' | 'box_plot' | 'treemap' | 'sankey';
  chartType?: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'heatmap' | 'histogram' | 'box_plot' | 'treemap' | 'sankey';
  name: string;
  confidence: number;
  reasoning: string;
  justification?: string;
  description: string;
  bestFor: string[];
  config?: any;
}

export default function AutoVizAgent({ readOnly = false, emitCursor, canvasId, isOwner }: { readOnly?: boolean; emitCursor?: (x: number, y: number) => void; canvasId?: string; isOwner?: boolean }) {
  // State management
  const [_visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [selectedVizId, setSelectedVizId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<ChartRecommendation[]>([]);
  
  // Dataset management with React Query — scoped to canvas when canvasId is present
  const { datasets } = useDatasetManager({ canvasId });

  // Canvas state — use selectors to avoid re-renders from unrelated store updates (e.g. cursor moves)
  const viewport = useCanvasStore(s => s.viewport);
  const canvasElements = useCanvasStore(s => s.canvasElements);
  const addElement = useCanvasStore(s => s.addElement);
  const { rawData, dataProfile, recommendations: storeRecommendations, agentStates, isLoading, startAnalysis } = useAnalysisStore();

  // Theme transition hook
  const { isDarkMode, isTransitioning, toggleTheme } = useThemeTransition();

  const { session } = useAuth();
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);
  // Captures the server-loaded layout so we don't auto-save on async element population
  const baselineLayoutKeyRef = useRef<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

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
        } catch {
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
      } catch {
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
      const processedRecommendations = RecommendationProcessor.processRecommendations(
        storeRecommendations,
        rawData,
        dataProfile
      );

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
  }, [startAnalysis]);

  const createVisualization = useCallback((
    dataset: Dataset,
    position: { x: number; y: number },
    type: Visualization['type'] = 'bar',
    recommendation?: ChartRecommendation
  ) => {
    // Create visualization for local state tracking
    const newViz: Visualization = {
      id: `viz-${Date.now()}`,
      title: type ? `${type.charAt(0).toUpperCase() + type.slice(1)} Chart` : 'Chart',
      type,
      dataSource: dataset.name,
      position,
      size: { width: 500, height: 400 },
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

    // Use viewport-aware positioning if no specific position provided
    const finalPosition = position || useCanvasStore.getState().getViewportCenterPosition();
    const canvasElement = {
      type: 'chart' as const,
      position: finalPosition,
      size: { width: 500, height: 400 },
      data: {
        config: {
          ...recommendation?.config,
          title: chartTitle
        },
        chartType: type,
        recommendation: recommendation,
        title: chartTitle,
        dataset: dataset
      }
    };

    const newElementId = addElement(canvasElement);

    // Broadcast new element to collaborators
    // Strip raw dataset rows — chart renders from config.data which is already embedded
    const store = useCanvasStore.getState();
    const justAdded = store.canvasElements.find((el) => el.id === newElementId);
    if (justAdded) {
      const { dataset: _dataset, ...dataWithoutRows } = justAdded.data ?? {};
      getActiveWebSocket()?.sendElementAdd({
        id: justAdded.id,
        type: justAdded.type,
        position: justAdded.position,
        size: justAdded.size,
        data: dataWithoutRows,
        zIndex: justAdded.zIndex,
      });
    }
  }, [addElement, viewport]);

  // Handle drag & drop from DataPanel to Canvas
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();

    if (rect && selectedDataset) {
      // Convert screen coordinates to canvas coordinates
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const canvasX = (screenX - viewport.x) / viewport.zoom;
      const canvasY = (screenY - viewport.y) / viewport.zoom;

      createVisualization(selectedDataset, { x: canvasX, y: canvasY });
    }
  }, [selectedDataset, viewport, createVisualization]);

  // Create visualization from recommendation
  const createVisualizationFromRecommendation = useCallback((
    recommendation: ChartRecommendation
  ) => {
    if (!selectedDataset) return;

    // Use the viewport-aware positioning from canvas store
    const centerPosition = useCanvasStore.getState().getViewportCenterPosition();

    createVisualization(
      selectedDataset,
      { x: centerPosition.x - 250, y: centerPosition.y - 200 },
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
    if (selectedVizId) {
      handleVisualizationDelete(selectedVizId);
    }
  }, [selectedVizId, handleVisualizationDelete]);

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
        <div className="flex-1 relative overflow-hidden">
          <InfiniteCanvas
            onCursorMove={emitCursor}
            onCanvasClick={(e) => {
              // Handle canvas clicks for adding elements
              if (e.detail === 2) { // Double click
                const rect = e.currentTarget.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const canvasX = (screenX - viewport.x) / viewport.zoom;
                const canvasY = (screenY - viewport.y) / viewport.zoom;

                if (selectedDataset) {
                  createVisualization(selectedDataset, { x: canvasX - 200, y: canvasY - 150 });
                }
              }
            }}
          >
            <div
              ref={canvasRef}
              className="w-[10000px] h-[10000px]"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {/* Render canvas store elements only - no duplicates */}
              {canvasElements.map((element) => (
                <CanvasElement
                  key={element.id}
                  element={element}
                  isSelected={selectedVizId === element.id}
                  onSelect={() => handleVisualizationSelect(element.id)}
                  onDelete={readOnly ? undefined : () => handleVisualizationDelete(element.id)}
                >
                  {element.type === 'chart' && (
                    <ChartCard
                      config={element.data?.config}
                      chartType={element.data?.chartType || 'bar'}
                      recommendation={element.data?.recommendation}
                      title={element.data?.title}
                    />
                  )}
                  {element.type === 'dataset' && (
                    <DatasetCard
                      data={element.data?.data || []}
                      dataProfile={element.data?.dataProfile}
                      title={element.data?.title || 'Dataset'}
                    />
                  )}
                  {element.type === 'map' && (
                    <MapCard
                      data={element.data?.data || []}
                      title={element.data?.title || 'Map'}
                      config={element.data?.config}
                    />
                  )}
                </CanvasElement>
              ))}
            </div>
          </InfiniteCanvas>

          {/* Floating Toolbar — hidden in read-only mode */}
          {!readOnly && (
            <FloatingToolbar
              onAddVisualization={handleAutoViz}
              onDeleteSelected={handleDeleteSelected}
              hasSelection={selectedVizId !== null}
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
