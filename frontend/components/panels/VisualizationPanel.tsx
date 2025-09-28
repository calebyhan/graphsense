'use client';

import React, { useState, useEffect } from 'react';
import { Wand2, TrendingUp, BarChart3, PieChart, LineChart, Zap, Map, Calendar, Grid3X3, Info, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dataset, ChartRecommendation } from '@/components/AutoVizAgent';
import AgentProgress from '@/components/analysis/AgentProgress';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { MiniMap } from '@/components/canvas/MiniMap';
import { useCanvasStore } from '@/store/useCanvasStore';

interface VisualizationPanelProps {
  selectedDataset: Dataset | null;
  recommendations: ChartRecommendation[];
  isAnalyzing: boolean;
  onCreateVisualization: (recommendation: ChartRecommendation) => void;
  onAutoViz: () => void;
  visualizationPositions?: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

const allChartTypes = [
  { type: 'line', name: 'Line Chart', icon: <LineChart className="w-4 h-4" /> },
  { type: 'bar', name: 'Bar Chart', icon: <BarChart3 className="w-4 h-4" /> },
  { type: 'pie', name: 'Pie Chart', icon: <PieChart className="w-4 h-4" /> },
  { type: 'scatter', name: 'Scatter Plot', icon: <Zap className="w-4 h-4" /> },
  { type: 'area', name: 'Area Chart', icon: <TrendingUp className="w-4 h-4" /> },
  { type: 'heatmap', name: 'Heatmap', icon: <Grid3X3 className="w-4 h-4" /> },
];

export function VisualizationPanel({
  selectedDataset,
  recommendations,
  isAnalyzing,
  onCreateVisualization,
  onAutoViz,
  visualizationPositions = []
}: VisualizationPanelProps) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'recommendations' | 'manual'>('analysis');
  const {
    rawData,
    agentStates,
    errorType,
    showErrorNotification,
    setShowErrorNotification,
    retryAnalysis
  } = useAnalysisStore();
  
  const { viewport, updateViewport } = useCanvasStore();

  // Auto-switch between tabs based on analysis state
  useEffect(() => {
    const isAnalysisComplete = Object.values(agentStates).every(state => state === 'complete');
    const isAnalysisInProgress = Object.values(agentStates).some(state => state === 'running');
    
    // Only switch tabs if we have data and aren't manually viewing a different tab
    if (rawData) {
      // If analysis just completed and we have recommendations, switch to smart tab
      if (isAnalysisComplete && recommendations.length > 0 && activeTab === 'analysis') {
        setActiveTab('recommendations');
      }
      // If analysis is starting/in progress and we're not on manual tab, switch to analysis
      else if (isAnalysisInProgress && activeTab !== 'manual') {
        setActiveTab('analysis');
      }
      // If we have data but no analysis has started and we're not on a specific tab, default to analysis
      else if (!isAnalysisInProgress && !isAnalysisComplete && activeTab !== 'manual' && activeTab !== 'recommendations') {
        setActiveTab('analysis');
      }
    }
  }, [agentStates, recommendations, rawData, activeTab]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
    if (confidence >= 75) return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20';
    return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800';
  };

  const handleManualChartCreate = (chartType: string) => {
    if (!selectedDataset) return;
    
    const manualRecommendation: ChartRecommendation = {
      id: `manual-${Date.now()}`,
      type: chartType as any,
      name: chartType ? `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart` : 'Chart',
      confidence: 75,
      reasoning: chartType ? `Manual selection of ${chartType} chart` : 'Manual chart selection',
      description: chartType ? `User-created ${chartType} visualization` : 'User-created visualization',
      bestFor: ['Manual analysis', 'Custom visualization']
    };
    
    onCreateVisualization(manualRecommendation);
  };

  return (
    <div className="w-80 h-full glass-effect border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-figma-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Visualization Intelligence</h2>
        
        {/* Auto-Viz Button */}
        <Button 
          className="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          onClick={onAutoViz}
          disabled={!selectedDataset || recommendations.length === 0 || isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
              Analyzing...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Auto-Viz
            </>
          )}
        </Button>

        {/* Tabs */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
          <button
            className={`flex-1 px-2 py-2 text-xs rounded-md transition-colors ${
              activeTab === 'analysis'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('analysis')}
          >
            Analysis
          </button>
          <button
            className={`flex-1 px-2 py-2 text-xs rounded-md transition-colors ${
              activeTab === 'recommendations'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('recommendations')}
          >
            Smart
          </button>
          <button
            className={`flex-1 px-2 py-2 text-xs rounded-md transition-colors ${
              activeTab === 'manual'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('manual')}
          >
            Manual
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'analysis' ? (
          // Analysis tab
          <div className="space-y-4">
            {!rawData ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                <img src="/favicon.ico" alt="Logo" className="w-20 h-20 mx-auto mb-3 opacity-30" />
                <h3 className="text-sm font-medium mb-2"></h3>
                <p className="text-xs mb-2">Upload a dataset to start AI analysis</p>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  <p>• 3-agent pipeline will analyze your data</p>
                  <p>• Real-time progress tracking</p>
                  <p>• Intelligent recommendations</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <AgentProgress
                  agentStates={agentStates}
                  errorType={errorType}
                  showErrorNotification={showErrorNotification}
                  onCloseErrorNotification={() => setShowErrorNotification(false)}
                  onRetryAnalysis={retryAnalysis}
                />
              </div>
            )}
          </div>
        ) : !selectedDataset ? (
          // No dataset selected state
          <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
            <img src="/favicon.ico" alt="Logo" className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">No Dataset Selected</h3>
            <p className="text-sm mb-4">Select a dataset from the left panel to see AI-powered visualization recommendations</p>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              <p>• AI analyzes your data structure</p>
              <p>• Suggests optimal chart types</p>
              <p>• Provides confidence scores</p>
            </div>
          </div>
        ) : activeTab === 'recommendations' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Recommended for {selectedDataset.name}
              </h3>
            </div>
            
            {isAnalyzing ? (
              // Loading state
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-3 animate-pulse">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                      <div className="w-12 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="w-3/4 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </Card>
                ))}
              </div>
            ) : recommendations.length > 0 ? (
              // Recommendations
              recommendations.map((rec) => (
                <Card 
                  key={rec.id}
                  className="p-3 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-600 group"
                  onClick={() => onCreateVisualization(rec)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                        {rec.type === 'line' && <LineChart className="w-5 h-5" />}
                        {rec.type === 'bar' && <BarChart3 className="w-5 h-5" />}
                        {rec.type === 'pie' && <PieChart className="w-5 h-5" />}
                        {rec.type === 'scatter' && <Zap className="w-5 h-5" />}
                        {rec.type === 'area' && <TrendingUp className="w-5 h-5" />}
                        {rec.type === 'heatmap' && <Grid3X3 className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{rec.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{rec.description}</p>
                      </div>
                    </div>
                    <Badge 
                      className={`text-xs ${getConfidenceColor(rec.confidence)}`}
                      variant="secondary"
                    >
                      {rec.confidence}%
                    </Badge>
                  </div>
                  
                  <div className="flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{rec.reasoning}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {rec.bestFor.slice(0, 2).map((use) => (
                      <Badge key={use} variant="outline" className="text-xs">
                        {use}
                      </Badge>
                    ))}
                    {rec.bestFor.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{rec.bestFor.length - 2}
                      </Badge>
                    )}
                  </div>

                  {/* Hover effect */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                    <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                      Click to add to canvas →
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              // No recommendations yet
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                <img src="/favicon.ico" alt="Logo" className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Analyzing dataset...</p>
                <p className="text-xs">AI recommendations will appear here</p>
              </div>
            )}
          </div>
        ) : (
          // Manual chart selection
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">All visualization types</h3>
            
            <div className="grid grid-cols-2 gap-2">
              {allChartTypes.map((chart) => (
                <Card
                  key={chart.type}
                  className="p-3 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-600 text-center group"
                  onClick={() => handleManualChartCreate(chart.type)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                      {chart.icon}
                    </div>
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{chart.name}</span>
                  </div>
                </Card>
              ))}
            </div>

            {/* Dataset Insights */}
            {selectedDataset && (
              <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Dataset Insights</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex justify-between">
                    <span>Numeric columns:</span>
                    <span>{selectedDataset.dataTypes.numerical}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Categorical columns:</span>
                    <span>{selectedDataset.dataTypes.categorical}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time columns:</span>
                    <span>{selectedDataset.dataTypes.temporal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Geographic columns:</span>
                    <span>{selectedDataset.dataTypes.geographic}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total rows:</span>
                    <span>{selectedDataset.rows.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mini Map */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <MiniMap
          visualizations={visualizationPositions}
          canvasSize={{ width: 10000, height: 10000 }}
          viewportSize={{ width: typeof window !== 'undefined' ? window.innerWidth : 1200, height: typeof window !== 'undefined' ? window.innerHeight : 800 }}
          viewportPosition={{ x: -viewport.x / viewport.zoom, y: -viewport.y / viewport.zoom, zoom: viewport.zoom }}
          onViewportChange={(position) => {
            updateViewport({
              x: -position.x * viewport.zoom,
              y: -position.y * viewport.zoom,
              zoom: viewport.zoom
            });
          }}
        />
      </div>
    </div>
  );
}
