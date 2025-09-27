/**
 * Backend Status Checker Component
 * Displays real-time backend connection status as a circular icon
 */

'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, Wifi, WifiOff, Activity } from 'lucide-react';
import { useDetailedHealthCheck } from '@/lib/api/backendQueries';

interface BackendStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  timestamp?: number;
  service?: string;
  dependencies?: {
    supabase?: string;
  };
  system?: {
    cpu_percent?: number;
    memory_percent?: number;
    disk_percent?: number;
    available_memory_mb?: number;
  };
  response_time?: number;
  last_checked?: number;
  error?: string;
}

export default function BackendStatusChecker() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Use React Query for health check with polling
  const { 
    data: healthData, 
    error, 
    isLoading,
    dataUpdatedAt 
  } = useDetailedHealthCheck();

  // Convert health data to status format
  const status: BackendStatus = React.useMemo(() => {
    if (!isOnline) {
      return { 
        status: 'unhealthy', 
        error: 'No internet connection',
        last_checked: Date.now()
      };
    }

    if (error) {
      return {
        status: 'unhealthy',
        error: (error as any)?.message || 'Network error',
        last_checked: dataUpdatedAt
      };
    }

    if (isLoading && !healthData) {
      return { status: 'unknown', last_checked: dataUpdatedAt };
    }

    return {
      ...healthData,
      last_checked: dataUpdatedAt
    };
  }, [healthData, error, isLoading, isOnline, dataUpdatedAt]);

  useEffect(() => {
    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    // Keyboard shortcut to toggle expanded view (Ctrl/Cmd + Shift + H)
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'H') {
        event.preventDefault();
        setIsExpanded(prev => !prev);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'unhealthy':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="h-4 w-4" />;
    }

    switch (status.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    
    switch (status.status) {
      case 'healthy':
        return 'Connected';
      case 'degraded':
        return 'Degraded';
      case 'unhealthy':
        return 'Disconnected';
      default:
        return 'Checking...';
    }
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  const getCircleColor = () => {
    if (!isOnline) return 'bg-gray-400';

    switch (status.status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unhealthy':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="relative">
      {/* Circular Status Indicator */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-3 h-3 rounded-full transition-all duration-200 hover:scale-110 ${getCircleColor()} ${
          status.status === 'unknown' ? 'animate-pulse' : ''
        }`}
        title={`Backend: ${getStatusText()}${status.response_time ? ` (${status.response_time}ms)` : ''}`}
      />

      {/* Expanded Details Tooltip */}
      {isExpanded && (
        <div className="absolute top-6 left-0 z-[60] min-w-80 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="space-y-3">
            {/* Basic Status Info */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Backend Status</span>
              <div className="flex items-center gap-1">
                {getStatusIcon()}
                <span className="text-sm font-medium">{status.status?.toUpperCase()}</span>
              </div>
            </div>

            {/* Service Info */}
            {status.service && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Service:</span>
                <span className="font-mono">{status.service}</span>
              </div>
            )}

            {/* Response Time */}
            {status.response_time && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Response Time:</span>
                <span className={`font-mono ${
                  status.response_time > 1000 ? 'text-red-600' :
                  status.response_time > 500 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {status.response_time}ms
                </span>
              </div>
            )}

            {/* Last Checked */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Last Checked:</span>
              <span className="text-gray-800 dark:text-gray-200">{formatTimestamp(status.last_checked)}</span>
            </div>

            {/* Dependencies */}
            {status.dependencies && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dependencies:</span>
                {Object.entries(status.dependencies).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm ml-2">
                    <span className="text-gray-600 dark:text-gray-400 capitalize">{key}:</span>
                    <span className={`font-medium ${
                      value === 'healthy' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* System Metrics */}
            {status.system && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">System:</span>
                {status.system.cpu_percent !== undefined && (
                  <div className="flex justify-between text-sm ml-2">
                    <span className="text-gray-600 dark:text-gray-400">CPU:</span>
                    <span className={`font-mono ${
                      status.system.cpu_percent > 80 ? 'text-red-600' :
                      status.system.cpu_percent > 60 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {status.system.cpu_percent.toFixed(1)}%
                    </span>
                  </div>
                )}
                {status.system.memory_percent !== undefined && (
                  <div className="flex justify-between text-sm ml-2">
                    <span className="text-gray-600 dark:text-gray-400">Memory:</span>
                    <span className={`font-mono ${
                      status.system.memory_percent > 85 ? 'text-red-600' :
                      status.system.memory_percent > 70 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {status.system.memory_percent.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {status.error && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
                <span className="text-red-800 dark:text-red-200 font-medium">Error: </span>
                <span className="text-red-700 dark:text-red-300">{status.error}</span>
              </div>
            )}

            {/* Manual Refresh Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                performHealthCheck();
              }}
              className="w-full mt-3 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>
      )}
    </div>
  );
}