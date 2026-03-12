'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface WheelEventData {
  deltaY: number;
  deltaX: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  timestamp: number;
  detected: string;
}

export function ZoomDebugger() {
  const [isVisible, setIsVisible] = useState(false);
  const [events, setEvents] = useState<WheelEventData[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  // Listen for Ctrl+Shift+D to toggle debugger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Record wheel events when visible
  useEffect(() => {
    if (!isVisible || !isRecording) return;

    const handleWheel = (e: WheelEvent) => {
      let detectedAs = 'Unknown';
      
      // Same detection logic as the canvas
      if (e.ctrlKey || e.metaKey) {
        detectedAs = 'Ctrl/Cmd + Wheel (Touchpad Pinch)';
      } else if (e.deltaMode === 0 && Math.abs(e.deltaY) < 50 && Math.abs(e.deltaY) > 0) {
        detectedAs = 'macOS Touchpad Pinch';
      } else if (Math.abs(e.deltaY) < 4 && Math.abs(e.deltaY) > 0.1) {
        detectedAs = 'Fine Touchpad Movement';
      } else if (e.deltaMode === 0 && Math.abs(e.deltaY) < 10 && Math.abs(e.deltaX) < 1) {
        detectedAs = 'Firefox Touchpad Pinch';
      } else if (Math.abs(e.deltaY) > 10) {
        detectedAs = 'Mouse Wheel';
      } else {
        detectedAs = 'Trackpad Scroll';
      }

      const eventData: WheelEventData = {
        deltaY: Math.round(e.deltaY * 100) / 100,
        deltaX: Math.round(e.deltaX * 100) / 100,
        deltaMode: e.deltaMode,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        timestamp: Date.now(),
        detected: detectedAs
      };

      setEvents(prev => [eventData, ...prev.slice(0, 19)]); // Keep last 20 events
    };

    document.addEventListener('wheel', handleWheel, { passive: true });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [isVisible, isRecording]);

  const clearEvents = () => {
    setEvents([]);
  };

  const getEventColor = (detected: string) => {
    if (detected.includes('Pinch')) return 'text-green-600 bg-green-50';
    if (detected.includes('Mouse')) return 'text-blue-600 bg-blue-50';
    if (detected.includes('Scroll')) return 'text-gray-600 bg-gray-50';
    return 'text-orange-600 bg-orange-50';
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-20 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="text-xs"
        >
          Debug Zoom (Ctrl+Shift+D)
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96">
      <Card className="p-4 glass-effect shadow-figma-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Zoom Event Debugger</h3>
          <div className="flex items-center gap-2">
            <Button
              variant={isRecording ? "destructive" : "default"}
              size="sm"
              onClick={() => setIsRecording(!isRecording)}
              className="text-xs"
            >
              {isRecording ? 'Stop' : 'Record'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearEvents}
              className="text-xs"
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="text-xs"
            >
              ×
            </Button>
          </div>
        </div>

        <div className="text-xs text-gray-600 mb-3">
          <div>• <strong>Try:</strong> Touchpad pinch, Ctrl+scroll, mouse wheel</div>
          <div>• <strong>Green:</strong> Detected as zoom gesture</div>
          <div>• <strong>Blue:</strong> Mouse wheel, <strong>Gray:</strong> Trackpad scroll</div>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {events.length === 0 ? (
            <div className="text-center text-gray-500 text-xs py-4">
              {isRecording ? 'Perform zoom gestures to see events...' : 'Click Record to start debugging'}
            </div>
          ) : (
            events.map((event, _index) => (
              <div
                key={event.timestamp}
                className={`p-2 rounded text-xs border ${getEventColor(event.detected)}`}
              >
                <div className="font-medium mb-1">{event.detected}</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>ΔY: {event.deltaY}</div>
                  <div>ΔX: {event.deltaX}</div>
                  <div>Mode: {event.deltaMode}</div>
                  <div>
                    {event.ctrlKey && '⌃'}{event.metaKey && '⌘'}{event.shiftKey && '⇧'}
                    {!event.ctrlKey && !event.metaKey && !event.shiftKey && '—'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 text-xs text-gray-500">
          <div><strong>Delta Modes:</strong> 0=Pixel, 1=Line, 2=Page</div>
          <div><strong>Keys:</strong> ⌃=Ctrl, ⌘=Cmd, ⇧=Shift</div>
        </div>
      </Card>
    </div>
  );
}
