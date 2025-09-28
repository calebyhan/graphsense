'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import InfiniteCanvas from '@/components/canvas/InfiniteCanvas';
import FloatingToolbar from '@/components/canvas/FloatingToolbar';
import { DataPanel } from '@/components/panels/DataPanel';
import { VisualizationPanel } from '@/components/panels/VisualizationPanel';
import { TopNavigation } from '@/components/navigation/TopNavigation';
import { MiniMap } from '@/components/canvas/MiniMap';
import { VisualizationCard } from '@/components/visualization/VisualizationCard';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';

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
}

export interface Visualization {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'heatmap';
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
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'heatmap';
  name: string;
  confidence: number;
  reasoning: string;
  description: string;
  bestFor: string[];
  config?: any;
}

export default function AutoVizAgent() {
  // State management
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [selectedVizId, setSelectedVizId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<ChartRecommendation[]>([]);
  
  // Canvas state
  const { viewport, updateViewport } = useCanvasStore();
  const { rawData, dataProfile, recommendations: storeRecommendations, agentStates, isLoading } = useAnalysisStore();
  
  const canvasRef = useRef<HTMLDivElement>(null);


  // Dark mode effect
  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Sync recommendations from store
  React.useEffect(() => {
    if (storeRecommendations && storeRecommendations.length > 0) {
      const formattedRecommendations = storeRecommendations.map((rec: any, index) => {
        const chartType = rec.chart_type || rec.type || 'chart';
        return {
          id: `rec-${index}`,
          type: chartType as any,
          name: chartType ? (chartType.charAt(0).toUpperCase() + chartType.slice(1)) : 'Chart',
          confidence: rec.confidence || 85,
          reasoning: rec.reasoning || rec.justification || `Great for your ${chartType} visualization needs`,
          description: rec.description || `Shows data using ${chartType} format`,
          bestFor: rec.best_for || rec.bestFor || ['Data visualization'],
          config: rec.config
        };
      });
      setRecommendations(formattedRecommendations);
    }
  }, [storeRecommendations]);

  // Sync analysis state
  React.useEffect(() => {
    setIsAnalyzing(isLoading);
  }, [isLoading]);

  // Handle dataset selection from DataPanel
  const handleDatasetSelect = useCallback(async (dataset: Dataset) => {
    setSelectedDataset(dataset);
  }, []);

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
    
    // Place in center of current viewport
    const centerX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 800) / viewport.zoom - viewport.x / viewport.zoom;
    const centerY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 600) / viewport.zoom - viewport.y / viewport.zoom;
    
    createVisualization(
      selectedDataset, 
      { x: centerX - 200, y: centerY - 150 }, 
      recommendation.type,
      recommendation
    );
  }, [selectedDataset, viewport]);

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
    const newViz: Visualization = {
      id: `viz-${Date.now()}`,
      title: type ? `${type.charAt(0).toUpperCase() + type.slice(1)} Chart` : 'Chart',
      type,
      dataSource: dataset.name,
      position,
      size: { width: 400, height: 300 },
      confidence: recommendation?.confidence,
      reasoning: recommendation?.reasoning,
      config: recommendation?.config
    };
    
    setVisualizations(prev => [...prev, newViz]);
    setSelectedVizId(newViz.id);
  }, []);

  // Visualization management
  const handleVisualizationSelect = useCallback((id: string) => {
    setSelectedVizId(id);
  }, []);

  const handleVisualizationPositionChange = useCallback((id: string, position: { x: number; y: number }) => {
    setVisualizations(prev =>
      prev.map(viz => viz.id === id ? { ...viz, position } : viz)
    );
  }, []);

  const handleVisualizationSizeChange = useCallback((id: string, size: { width: number; height: number }) => {
    setVisualizations(prev =>
      prev.map(viz => viz.id === id ? { ...viz, size } : viz)
    );
  }, []);

  const handleVisualizationDelete = useCallback((id: string) => {
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

  // Prepare visualization positions for MiniMap
  const visualizationPositions = visualizations.map(viz => ({
    id: viz.id,
    x: viz.position.x,
    y: viz.position.y,
    width: viz.size.width,
    height: viz.size.height
  }));

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-900 prevent-zoom">
      {/* Top Navigation */}
      <TopNavigation 
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Data Panel - Left Sidebar */}
        <div className="flex flex-col">
          <DataPanel
            datasets={[]}
            selectedDataset={selectedDataset}
            onDatasetSelect={handleDatasetSelect}
          />
        </div>

        {/* Canvas Area - Center */}
        <div className="flex-1 relative overflow-hidden">
          <InfiniteCanvas
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
              {visualizations.map((viz) => (
                <VisualizationCard
                  key={viz.id}
                  id={viz.id}
                  title={viz.title}
                  type={viz.type}
                  dataSource={viz.dataSource}
                  lastUpdated="just now"
                  position={viz.position}
                  size={viz.size}
                  isSelected={selectedVizId === viz.id}
                  onSelect={handleVisualizationSelect}
                  onPositionChange={handleVisualizationPositionChange}
                  onSizeChange={handleVisualizationSizeChange}
                  onDelete={handleVisualizationDelete}
                />
              ))}
            </div>
          </InfiniteCanvas>

          {/* Floating Toolbar */}
          <FloatingToolbar
            onAddVisualization={handleAutoViz}
            onDeleteSelected={handleDeleteSelected}
            hasSelection={selectedVizId !== null}
          />

          {/* Mini Map */}
          <MiniMap
            visualizations={visualizationPositions}
            canvasSize={{ width: 10000, height: 10000 }}
            viewportSize={{ width: typeof window !== 'undefined' ? window.innerWidth : 1200, height: typeof window !== 'undefined' ? window.innerHeight : 800 }}
            viewportPosition={{ x: -viewport.x / viewport.zoom, y: -viewport.y / viewport.zoom }}
            onViewportChange={(position) => {
              updateViewport({
                x: -position.x * viewport.zoom,
                y: -position.y * viewport.zoom,
                zoom: viewport.zoom
              });
            }}
          />
        </div>

        {/* Visualization Panel - Right Sidebar */}
        <VisualizationPanel 
          selectedDataset={selectedDataset}
          recommendations={recommendations}
          isAnalyzing={isAnalyzing}
          onCreateVisualization={createVisualizationFromRecommendation}
          onAutoViz={handleAutoViz}
        />
      </div>
    </div>
  );
}
