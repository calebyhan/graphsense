'use client';

import { useEffect, useState } from 'react';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { AgentPipeline } from '@/lib/agents/AgentPipeline';
import AgentProgress from './AgentProgress';
import { Play, AlertCircle } from 'lucide-react';

export default function AnalysisSection() {
  const {
    rawData,
    agentStates,
    updateAgentState,
    setDataProfile,
    setPatterns,
    setRecommendations
  } = useAnalysisStore();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const runAnalysis = async () => {
    if (!rawData || rawData.length === 0) return;

    setIsAnalyzing(true);
    setError('');

    try {
      const pipeline = new AgentPipeline((agent, state) => {
        updateAgentState(agent as keyof typeof agentStates, state as any);
      });

      const result = await pipeline.analyze(rawData);

      setDataProfile(result.profile);
      setPatterns(result.patterns);
      setRecommendations(result.recommendations);
      setHasAnalyzed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-start analysis when data is available
  useEffect(() => {
    if (rawData && !isAnalyzing && !hasAnalyzed) {
      const timer = setTimeout(() => {
        runAnalysis();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [rawData, isAnalyzing, hasAnalyzed]);

  if (!rawData) {
    return null;
  }

  const canStartAnalysis = rawData && !isAnalyzing && !hasAnalyzed;
  const isComplete = Object.values(agentStates).every(state => state === 'complete');

  return (
    <div className="space-y-6">
      {/* Analysis Control */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Dataset Analysis
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {isAnalyzing
                ? 'AI agents are analyzing your data...'
                : isComplete
                ? 'Analysis complete! Check the recommendations below.'
                : 'Ready to analyze your uploaded dataset'
              }
            </p>
          </div>

          {canStartAnalysis && (
            <button
              onClick={runAnalysis}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Play className="h-4 w-4" />
              Start Analysis
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Analysis Failed</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={() => {
                    setError('');
                    setHasAnalyzed(false);
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium mt-2"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Agent Progress */}
      {(isAnalyzing || isComplete) && (
        <AgentProgress agentStates={agentStates} />
      )}
    </div>
  );
}