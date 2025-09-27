'use client';

import { AgentState } from '@/lib/types';
import { CheckCircle, Loader2, Brain, Database, BarChart3, Shield, AlertTriangle, Clock } from 'lucide-react';
import ErrorNotification, { ErrorType } from '@/components/common/ErrorNotification';

interface AgentProgressProps {
  agentStates: AgentState;
  errorType?: ErrorType | null;
  showErrorNotification?: boolean;
  onCloseErrorNotification?: () => void;
  onRetryAnalysis?: () => void;
}

const agentInfo = {
  profiler: {
    name: 'Enhanced Data Profiler',
    description: 'Comprehensive statistical analysis, correlation detection, and data quality assessment',
    activeDescription: 'Analyzing data patterns, correlations, and quality metrics',
    icon: Database
  },
  recommender: {
    name: 'Chart Recommender',
    description: 'Evaluating all 10 chart types with confidence scoring and data mapping',
    activeDescription: 'Generating recommendations for Bar, Line, Scatter, Pie, Histogram, Box Plot, Heatmap, Area, Treemap, and Sankey charts',
    icon: BarChart3
  },
  validator: {
    name: 'Validation Agent',
    description: 'Quality assessment, appropriateness validation, and recommendation refinement',
    activeDescription: 'Validating chart recommendations and calculating quality scores',
    icon: Shield
  }
};

export default function AgentProgress({ 
  agentStates, 
  errorType, 
  showErrorNotification = false,
  onCloseErrorNotification,
  onRetryAnalysis 
}: AgentProgressProps) {
  const getAgentIcon = (state: string, agentKey: keyof AgentState, hasError: boolean) => {
    const AgentIcon = agentInfo[agentKey].icon;

    if (hasError && state === 'running') {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }

    switch (state) {
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <AgentIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStateColor = (state: string, hasError: boolean) => {
    if (hasError && state === 'running') {
      return 'text-red-600';
    }
    
    switch (state) {
      case 'running':
        return 'text-blue-600';
      case 'complete':
        return 'text-green-600';
      default:
        return 'text-gray-500';
    }
  };

  const agentOrder: Array<keyof AgentState> = ['profiler', 'recommender', 'validator'];
  const completedCount = agentOrder.filter(key => agentStates[key] === 'complete').length;
  const currentlyRunning = agentOrder.find(key => agentStates[key] === 'running');
  const overallProgress = (completedCount / agentOrder.length) * 100;
  
  // Check if there's an error affecting the current running agent
  const hasError = errorType && (errorType === 'timeout' || errorType === 'rate_limit' || errorType === 'general');
  const errorMessage = errorType === 'rate_limit' 
    ? 'AI service rate limited. Retrying automatically...' 
    : errorType === 'timeout'
    ? 'Analysis timeout detected. Agent may be stalled.'
    : errorType === 'general'
    ? 'Analysis error occurred.'
    : null;

  return (
    <>
      {/* Error Notification */}
      {errorType && showErrorNotification && (
        <ErrorNotification
          isVisible={showErrorNotification}
          errorType={errorType}
          onClose={() => onCloseErrorNotification?.()}
          onRetry={onRetryAnalysis}
        />
      )}
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          3-Agent AI Pipeline
        </h3>
        <div className="text-sm text-gray-600">
          {completedCount}/{agentOrder.length} completed
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Overall Progress</span>
          <span>{Math.round(overallProgress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {agentOrder.map((agentKey, index) => {
          const agent = agentInfo[agentKey];
          const state = agentStates[agentKey];
          const isActive = state === 'running';
          const isNext = currentlyRunning === agentKey || (completedCount === index && state === 'idle');

          return (
            <div key={agentKey} className={`relative flex items-start gap-3 p-3 rounded-lg transition-all duration-200 ${
              isActive ? 'bg-blue-50 border border-blue-200' :
              state === 'complete' ? 'bg-green-50 border border-green-200' :
              isNext ? 'bg-gray-50 border border-gray-200' : 'border border-transparent'
            }`}>
              {/* Connection Line */}
              {index < agentOrder.length - 1 && (
                <div className="absolute left-[22px] top-8 w-0.5 h-8 bg-gray-300" />
              )}

              <div className="flex-shrink-0 mt-0.5 relative z-10">
                {getAgentIcon(state, agentKey, Boolean(hasError && currentlyRunning === agentKey))}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-gray-900">
                    {agent.name}
                  </h4>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    hasError && state === 'running' && currentlyRunning === agentKey ? 'bg-red-100 text-red-700' :
                    state === 'running' ? 'bg-blue-100 text-blue-700' :
                    state === 'complete' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {hasError && state === 'running' && currentlyRunning === agentKey ? (
                      errorType === 'rate_limit' ? 'Rate Limited' :
                      errorType === 'timeout' ? 'Timeout' : 'Error'
                    ) : (
                      state === 'running' ? 'Running...' :
                      state === 'complete' ? 'Complete' :
                      isNext ? 'Next' : 'Pending'
                    )}
                  </span>
                </div>

                <p className="text-sm text-gray-600">
                  {hasError && state === 'running' && currentlyRunning === agentKey 
                    ? errorMessage
                    : state === 'running' 
                    ? agent.activeDescription 
                    : agent.description
                  }
                </p>

                {state === 'running' && (
                  <div className="mt-3">
                    <div className={`w-full rounded-full h-1.5 ${
                      hasError && currentlyRunning === agentKey ? 'bg-red-200' : 'bg-blue-200'
                    }`}>
                      <div className={`h-1.5 rounded-full w-2/3 ${
                        hasError && currentlyRunning === agentKey 
                          ? 'bg-red-500 animate-pulse' 
                          : 'bg-blue-500 animate-pulse'
                      }`}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {completedCount === agentOrder.length && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-green-800">
              Analysis Complete! Ready to explore recommendations.
            </span>
          </div>
        </div>
      )}
    </div>
    </>
  );
}