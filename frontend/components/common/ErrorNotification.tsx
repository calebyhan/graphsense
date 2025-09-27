'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, RefreshCw, Clock } from 'lucide-react';

export type ErrorType = 'rate_limit' | 'timeout' | 'network' | 'general';

interface ErrorNotificationProps {
  isVisible: boolean;
  errorType: ErrorType;
  message?: string;
  onClose: () => void;
  onRetry?: () => void;
  autoHideDuration?: number; // in milliseconds
}

const errorConfig = {
  rate_limit: {
    icon: Clock,
    title: 'AI Service Quota Exceeded',
    defaultMessage: 'The Google Gemini API free tier quota has been exceeded. Analysis will resume when quota resets or you can upgrade your plan.',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    iconColor: 'text-yellow-500'
  },
  timeout: {
    icon: AlertTriangle,
    title: 'Analysis Timeout',
    defaultMessage: 'Analysis is taking longer than expected. The agent may be stalled.',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500'
  },
  network: {
    icon: AlertTriangle,
    title: 'Network Error',
    defaultMessage: 'Unable to connect to the backend service. Please check your connection.',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500'
  },
  general: {
    icon: AlertTriangle,
    title: 'Analysis Error',
    defaultMessage: 'An unexpected error occurred during analysis.',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500'
  }
};

export default function ErrorNotification({
  isVisible,
  errorType,
  message,
  onClose,
  onRetry,
  autoHideDuration = 10000 // 10 seconds default
}: ErrorNotificationProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      
      // Auto-hide for rate limit errors (they usually resolve themselves)
      if (errorType === 'rate_limit' && autoHideDuration > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, autoHideDuration);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, errorType, autoHideDuration]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => onClose(), 300); // Wait for exit animation
  };

  if (!isVisible) return null;

  const config = errorConfig[errorType];
  const IconComponent = config.icon;
  const displayMessage = message || config.defaultMessage;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`max-w-md p-4 rounded-lg border shadow-lg transition-all duration-300 ${
          isAnimating 
            ? 'transform translate-x-0 opacity-100' 
            : 'transform translate-x-full opacity-0'
        } ${config.bgColor} ${config.borderColor}`}
      >
        <div className="flex items-start gap-3">
          <IconComponent className={`h-5 w-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
          
          <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-semibold ${config.color}`}>
              {config.title}
            </h4>
            <p className="text-sm text-gray-700 mt-1">
              {displayMessage}
            </p>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3">
              {onRetry && errorType !== 'rate_limit' && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry Analysis
                </button>
              )}
              
              {errorType === 'rate_limit' && (
                <div className="text-xs text-gray-600">
                  Will retry automatically...
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar for rate limit countdown */}
        {errorType === 'rate_limit' && autoHideDuration > 0 && (
          <div className="mt-3">
            <div className="w-full bg-yellow-200 rounded-full h-1">
              <div 
                className="bg-yellow-400 h-1 rounded-full transition-all duration-300 ease-linear"
                style={{
                  animation: `shrink ${autoHideDuration}ms linear`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}