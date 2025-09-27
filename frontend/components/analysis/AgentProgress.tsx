'use client';

import { AgentState } from '@/lib/types';
import { CheckCircle, Loader2, Brain, Database, BarChart3, Shield } from 'lucide-react';

interface AgentProgressProps {
  agentStates: AgentState;
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

export default function AgentProgress({ agentStates }: AgentProgressProps) {
  const getAgentIcon = (state: string, agentKey: keyof AgentState) => {
    const AgentIcon = agentInfo[agentKey].icon;

    switch (state) {
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <AgentIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStateColor = (state: string) => {
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

  return (
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
                {getAgentIcon(state, agentKey)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-gray-900">
                    {agent.name}
                  </h4>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    state === 'running' ? 'bg-blue-100 text-blue-700' :
                    state === 'complete' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {state === 'running' ? 'Running...' :
                     state === 'complete' ? 'Complete' :
                     isNext ? 'Next' : 'Pending'}
                  </span>
                </div>

                <p className="text-sm text-gray-600">
                  {state === 'running' ? agent.activeDescription : agent.description}
                </p>

                {state === 'running' && (
                  <div className="mt-3">
                    <div className="w-full bg-blue-200 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full animate-pulse w-2/3"></div>
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
  );
}