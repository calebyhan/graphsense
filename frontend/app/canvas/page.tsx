'use client';

import React, { useCallback } from 'react';
import InfiniteCanvas from '@/components/canvas/InfiniteCanvas';
import BottomToolbar from '@/components/canvas/BottomToolbar';
import CanvasElement from '@/components/canvas/CanvasElement';
import DatasetCard from '@/components/canvas/elements/DatasetCard';
import ChartCard from '@/components/canvas/elements/ChartCard';
import TableCard from '@/components/canvas/elements/TableCard';
import MapCard from '@/components/canvas/elements/MapCard';
import TextCard from '@/components/canvas/elements/TextCard';
import ChartCreationModal from '@/components/charts/ChartCreationModal';
import DataLoader from '@/components/canvas/DataLoader';
import DatasetPanel from '@/components/canvas/DatasetPanel';
import BackendStatusChecker from '@/components/canvas/BackendStatusChecker';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Brain, Home } from 'lucide-react';
import Link from 'next/link';

export default function CanvasPage() {
  const { canvasElements, selectedTool, addElement } = useCanvasStore();
  const { rawData, dataProfile, recommendations, selectedChart, parsedData } = useAnalysisStore();
  const [showChartModal, setShowChartModal] = React.useState(false);

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Handle canvas clicks for adding new elements
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (selectedTool === 'pointer' || selectedTool === 'drag') return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert screen coordinates to canvas coordinates
    const viewport = useCanvasStore.getState().viewport;
    const canvasX = (x - viewport.x) / viewport.zoom;
    const canvasY = (y - viewport.y) / viewport.zoom;

    switch (selectedTool) {
      case 'dataset':
        if (rawData) {
          addElement({
            type: 'dataset',
            position: { x: canvasX, y: canvasY },
            size: { width: 400, height: 300 },
            data: { rawData, dataProfile }
          });
        }
        break;
      case 'chart':
        setShowChartModal(true);
        break;
      case 'table':
        addElement({
          type: 'table',
          position: { x: canvasX, y: canvasY },
          size: { width: 600, height: 400 },
          data: { rawData: parsedData || rawData || [] }
        });
        break;
      case 'text':
        addElement({
          type: 'text',
          position: { x: canvasX, y: canvasY },
          size: { width: 300, height: 200 },
          data: { content: '', title: 'Text Block' }
        });
        break;
      case 'map':
        addElement({
          type: 'map',
          position: { x: canvasX, y: canvasY },
          size: { width: 500, height: 400 },
          data: { rawData: parsedData || rawData || [] }
        });
        break;
    }
  }, [selectedTool, rawData, dataProfile, selectedChart, recommendations, addElement]);

  const renderElementContent = (element: any) => {
    switch (element.type) {
      case 'dataset':
        return (
          <DatasetCard
            data={element.data?.rawData || []}
            dataProfile={element.data?.dataProfile}
            title="Dataset"
          />
        );
      case 'chart':
        return (
          <ChartCard
            config={element.data?.config}
            chartType={element.data?.chartType || 'bar'}
            recommendation={element.data?.recommendation}
            title={element.data?.config?.title}
          />
        );
      case 'table':
        return (
          <TableCard
            data={element.data?.rawData || []}
            title={element.data?.title || 'Data Table'}
          />
        );
      case 'text':
        return (
          <TextCard
            initialContent={element.data?.content || ''}
            title={element.data?.title || 'Text Block'}
            editable={true}
          />
        );
      case 'map':
        return (
          <MapCard
            data={element.data?.rawData || []}
            title={element.data?.title || 'Map Visualization'}
            config={element.data?.config}
          />
        );
      default:
        return <div>Unknown element type</div>;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Backend Status Checker */}
      <BackendStatusChecker />

      {/* Top Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Auto Viz Agent
              </h1>
              <p className="text-sm text-gray-600">
                AI-powered data visualization workspace
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="text-sm">Home</span>
          </Link>
        </div>
      </header>

      {/* Canvas Area */}
      <div className="flex-1 relative">
        <InfiniteCanvas>
          <div onClick={handleCanvasClick} className="w-[10000px] h-[10000px]">
            {canvasElements.map((element) => (
              <CanvasElement key={element.id} element={element}>
                {renderElementContent(element)}
              </CanvasElement>
            ))}
          </div>
        </InfiniteCanvas>
      </div>

      {/* Bottom Toolbar */}
      <BottomToolbar />

      {/* Data Loader */}
      <DataLoader />

      {/* Dataset Panel */}
      <DatasetPanel />

      {/* Chart Creation Modal */}
      <ChartCreationModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
      />
    </div>
  );
}