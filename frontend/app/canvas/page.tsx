'use client';

import React from 'react';
import AutoVizAgent from '@/components/AutoVizAgent';
import DataLoader from '@/components/canvas/DataLoader';
import { CanvasDebugTools } from '@/components/debug/CanvasDebugTools';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function CanvasPage() {
  console.log('🎨 CanvasPage component loading...');
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  React.useEffect(() => {
    console.log('🎨 CanvasPage mounted successfully');
  }, []);

  return (
    <>
      {/* Main Auto Viz Agent Application */}
      <AutoVizAgent />
      
      {/* Data Loader */}
      <DataLoader />

      {/* Debug Tools - Only in development */}
      {process.env.NODE_ENV === 'development' && <CanvasDebugTools />}

    </>
  );
}