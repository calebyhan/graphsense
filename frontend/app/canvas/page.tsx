'use client';

import React from 'react';
import AutoVizAgent from '@/components/AutoVizAgent';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function CanvasPage() {
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <>
      {/* Main Auto Viz Agent Application */}
      <AutoVizAgent />
    </>
  );
}