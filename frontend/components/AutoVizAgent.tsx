'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import InfiniteCanvas from '@/components/canvas/InfiniteCanvas';
import FloatingToolbar from '@/components/canvas/FloatingToolbar';
import { DataPanel } from '@/components/panels/DataPanel';
import { VisualizationPanel } from '@/components/panels/VisualizationPanel';
import { TopNavigation } from '@/components/navigation/TopNavigation';

import { VisualizationCard } from '@/components/visualization/VisualizationCard';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { getActiveWebSocket } from '@/lib/realtime/canvasWebSocket';
import { useThemeTransition } from '@/hooks/useThemeTransition';
import { useDatasetManager } from '@/hooks/useDatasetManager';
import { RecommendationProcessor } from '@/lib/services/recommendationProcessor';
import { DatasetAttributeBuilder } from '@/lib/services/datasetAttributeBuilder';
import CanvasElement from '@/components/canvas/CanvasElement';
import ChartCard from '@/components/canvas/elements/ChartCard';
import DatasetCard from '@/components/canvas/elements/DatasetCard';
import MapCard from '@/components/canvas/elements/MapCard';

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
  console.log('AutoVizAgent component mounting...');
  
  // State management
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [selectedVizId, setSelectedVizId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<ChartRecommendation[]>([]);
  
  // Dataset management with React Query (read-only for AutoVizAgent)
  const { datasets } = useDatasetManager();
  
  // Canvas state
  const { viewport, updateViewport, canvasElements, addElement } = useCanvasStore();
  const { rawData, dataProfile, recommendations: storeRecommendations, agentStates, isLoading, setRecommendations: setStoreRecommendations, startAnalysis } = useAnalysisStore();
  
  // Debug logging for state changes
  React.useEffect(() => {
    console.log('AutoVizAgent state changed:', {
      hasRawData: !!rawData,
      rawDataLength: rawData?.length,
      hasDataProfile: !!dataProfile,
      isLoading,
      agentStates,
      datasetsCount: datasets.length
    });
  }, [rawData, dataProfile, isLoading, agentStates, datasets.length]);
  
  // Theme transition hook
  const { isDarkMode, isTransitioning, toggleTheme } = useThemeTransition();
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Mount effect
  React.useEffect(() => {
    console.log('AutoVizAgent mounted successfully');
    return () => {
      console.log('AutoVizAgent unmounting');
    };
  }, []);

  // Sync recommendations from store and process them with our new system
  React.useEffect(() => {
    if (storeRecommendations && storeRecommendations.length > 0 && rawData) {
      console.log('Processing recommendations with new parameter extraction system:', {
        recommendationsCount: storeRecommendations.length,
        rawDataLength: rawData.length,
        sampleRecommendation: storeRecommendations[0]
      });

      // Use our new RecommendationProcessor to enhance recommendations
      const processedRecommendations = RecommendationProcessor.processRecommendations(
        storeRecommendations,
        rawData,
        dataProfile
      );

      console.log('Processed recommendations:', processedRecommendations);

      // Debug: Check if data is properly embedded in configs
      processedRecommendations.forEach((rec, index) => {
        console.log(`Recommendation ${index} data check:`, {
          chartType: rec.chartType,
          hasConfig: !!rec.config,
          hasData: !!rec.config?.data,
          dataLength: rec.config?.data?.length,
          configKeys: rec.config ? Object.keys(rec.config) : [],
          sampleDataRow: rec.config?.data?.[0]
        });
      });

      // Convert to the format expected by the UI
      const formattedRecommendations = processedRecommendations.map((rec, index) => ({
        id: `rec-${index}`,
        type: rec.chartType,
        chartType: rec.chartType, // Add this for compatibility
        name: rec.chartType.charAt(0).toUpperCase() + rec.chartType.slice(1),
        confidence: rec.confidence,
        reasoning: rec.justification,
        justification: rec.justification, // Add this for compatibility
        description: `Shows data using ${rec.chartType} format`,
        bestFor: ['Data visualization'],
        config: rec.config
      }));

            console.log('Final formatted recommendations:', formattedRecommendations);

            // Debug: Check if data is still present after formatting
            formattedRecommendations.forEach((rec, index) => {
              console.log(`Formatted recommendation ${index} data check:`, {
                chartType: rec.chartType,
                hasConfig: !!rec.config,
                hasData: !!rec.config?.data,
                dataLength: rec.config?.data?.length,
                configKeys: rec.config ? Object.keys(rec.config) : []
              });
            });

            setRecommendations(formattedRecommendations);
    } else if (storeRecommendations && storeRecommendations.length > 0 && !rawData) {
      console.warn('Recommendations available but no raw data for processing');
      console.warn('Debug - Store state:', {
        hasStoreRecommendations: !!storeRecommendations,
        storeRecommendationsLength: storeRecommendations?.length || 0,
        hasRawData: !!rawData,
        rawDataLength: rawData ? (rawData as any[]).length : 0,
        sampleStoreRecommendation: storeRecommendations?.[0]
      });
    }
  }, [storeRecommendations, rawData, dataProfile]);

  // Sync analysis state
  React.useEffect(() => {
    setIsAnalyzing(isLoading);
  }, [isLoading]);

  // Auto-select dataset when analysis data is available (only if no manual selection)
  React.useEffect(() => {
    console.log('Auto-selection effect triggered:', {
      hasRawData: !!rawData,
      rawDataLength: rawData?.length,
      hasSelectedDataset: !!selectedDataset,
      hasDataProfile: !!dataProfile,
      isLoading,
      datasetsLength: datasets.length
    });

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
        console.log('Auto-selecting matching dataset:', matchingDataset.name);
        setSelectedDataset(matchingDataset);
        // Note: Don't start analysis here - let the selection effect handle it
      }
    }
  }, [rawData, selectedDataset, datasets]);

  // Handle dataset selection from DataPanel
  const handleDatasetSelect = useCallback(async (dataset: Dataset) => {
    console.log('Dataset selected in AutoVizAgent:', dataset.name, 'with data length:', dataset.data?.length);
    setSelectedDataset(dataset);

    // Start analysis if dataset has data
    if (dataset.data && dataset.data.length > 0) {
      console.log('Starting analysis for selected dataset:', dataset.name);
      startAnalysis(dataset.data, dataset.name, dataset.id);
    } else {
      console.warn('Selected dataset has no data:', dataset.name);
    }
  }, [startAnalysis]);

  // Handle drag & drop from DataPanel to Canvas
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const datasetId = e.dataTransfer.getData('text/plain');
    const rect = canvasRef.current?.getBoundingClientRect();
    
    if (rect && selectedDataset) {
      // Convert screen coordinates to canvas coordinates
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const canvasX = (screenX - viewport.x) / viewport.zoom;
      const canvasY = (screenY - viewport.y) / viewport.zoom;
      
      createVisualization(selectedDataset, { x: canvasX, y: canvasY });
    }
  }, [selectedDataset, viewport]);

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
  }, [selectedDataset]);

  // Auto-Viz function
  const handleAutoViz = useCallback(async () => {
    if (!selectedDataset || recommendations.length === 0) return;
    
    // Create the top recommendation automatically
    const topRecommendation = recommendations[0];
    createVisualizationFromRecommendation(topRecommendation);
  }, [selectedDataset, recommendations, createVisualizationFromRecommendation]);

  const createVisualization = useCallback((
    dataset: Dataset,
    position: { x: number; y: number },
    type: Visualization['type'] = 'bar',
    recommendation?: ChartRecommendation
  ) => {
    console.log('createVisualization called:', {
      type,
      hasRecommendation: !!recommendation,
      hasConfig: !!recommendation?.config,
      hasData: !!recommendation?.config?.data,
      dataLength: recommendation?.config?.data?.length,
      configKeys: recommendation?.config ? Object.keys(recommendation.config) : []
    });

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

    console.log('🎯 AutoVizAgent: Adding to canvas store:', {
      canvasElement,
      viewport,
      finalPosition,
      rawPosition: position
    });
    addElement(canvasElement);

    // Broadcast new element to collaborators
    const store = useCanvasStore.getState();
    const justAdded = store.canvasElements[store.canvasElements.length - 1];
    if (justAdded) {
      getActiveWebSocket()?.sendElementAdd({
        id: justAdded.id,
        type: justAdded.type,
        position: justAdded.position,
        size: justAdded.size,
        data: justAdded.data,
        zIndex: justAdded.zIndex,
      });
    }
  }, [addElement]);

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
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Data Panel - Left Sidebar */}
        <div className="flex flex-col">
          <DataPanel
            selectedDataset={selectedDataset}
            onDatasetSelect={handleDatasetSelect}
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
