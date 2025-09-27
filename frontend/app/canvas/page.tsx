'use client';

import React from 'react';
import AutoVizAgent from '@/components/AutoVizAgent';
import BackendStatusChecker from '@/components/canvas/BackendStatusChecker';
import DataLoader from '@/components/canvas/DataLoader';
import { ZoomDebugger } from '@/components/debug/ZoomDebugger';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function CanvasPage() {
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <>
      {/* Backend Status Checker */}
      <BackendStatusChecker />
      
      {/* Main Auto Viz Agent Application */}
      <AutoVizAgent />
      
      {/* Data Loader */}
      <DataLoader />

      {/* Debug Component (Development only) */}
      {process.env.NODE_ENV === 'development' && <ZoomDebugger />}
    </>
  );
}