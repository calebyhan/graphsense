'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';


export default function DataLoader() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed top-6 right-6 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Quick Start</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-gray-500 hover:text-gray-700" />
          </button>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Upload your data files</p>
            <p>• Get AI-powered chart recommendations</p>
            <p>• Create visualizations on the canvas</p>
          </div>
        </div>
      </div>
    </div>
  );
}