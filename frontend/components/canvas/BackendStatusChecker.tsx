/**
 * Backend Status Checker Component
 * Displays real-time backend connection status on the canvas
 */

'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, WifiOff, Activity } from 'lucide-react';
import { backendAPI } from '@/lib/api/backendClient';

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
  const [status, setStatus] = useState<BackendStatus>({ status: 'unknown' });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);

  const checkBackendHealth = async (): Promise<BackendStatus> => {
    const startTime = Date.now();
    
    try {
      // Try detailed health check first
      const data = await backendAPI.detailedHealthCheck();
      const responseTime = Date.now() - startTime;

      return {
        ...data,
        response_time: responseTime,
        last_checked: Date.now(),
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // If detailed check fails, try basic health check
      try {
        const basicData = await backendAPI.healthCheck();
        return {
          ...basicData,
          response_time: responseTime,
          last_checked: Date.now(),
        };
      } catch (basicError: any) {
        return {
          status: 'unhealthy',
          error: basicError.message || error.message || 'Network error',
          response_time: responseTime,
          last_checked: Date.now(),
        };
      }
    }
  };

  const performHealthCheck = async () => {
    const healthStatus = await checkBackendHealth();
    setStatus(healthStatus);
  };

  useEffect(() => {
    // Initial check
    performHealthCheck();

    // Set up polling interval
    const interval = setInterval(performHealthCheck, 30000); // Check every 30 seconds

    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      performHealthCheck();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setStatus(prev => ({ ...prev, status: 'unhealthy', error: 'No internet connection' }));
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
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="relative flex items-center justify-center">
      {/* Circular Status Indicator with Pulsating Ring */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative w-4 h-4 rounded-full transition-all duration-200 hover:scale-110 shadow-sm ${getCircleColor()} ${
          status.status === 'unknown' ? 'animate-pulse' : ''
        }`}
        title={`Backend: ${getStatusText()}${status.response_time ? ` (${status.response_time}ms)` : ''}`}
      >
        {/* Pulsating Ring Effect */}
        <span className={`absolute inset-0 rounded-full animate-ping ${getCircleColor()} opacity-75`} />
        <span className={`absolute inset-0 rounded-full ${getCircleColor()}`} />
      </button>

      {/* Expanded Details Tooltip */}
      {isExpanded && (
        <div className="absolute top-6 right-0 z-[60] min-w-80 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
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
            
            {/* Keyboard Shortcut Hint */}
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              Press Ctrl+Shift+H to toggle
            </div>
          </div>
        </div>
      )}
    </div>
  );
}