import { create } from 'zustand';
import {
  AnalysisStore,
  AgentState,
  DataProfile,
  Pattern,
  ChartRecommendation,
  ChartConfig
} from '@/lib/types';
import { backendAPI } from '@/lib/api/backendClient';

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  rawData: null,
  parsedData: null,
  agentStates: {
    profiler: 'idle',
    pattern: 'idle',
    recommender: 'idle'
  },
  dataProfile: null,
  patterns: null,
  recommendations: null,
  selectedChart: null,
  currentDatasetId: null,
  isLoading: false,
  error: null,

  setRawData: (data) => set({ rawData: data, parsedData: data }),

  updateAgentState: (agent, state) =>
    set((prev) => ({
      agentStates: { ...prev.agentStates, [agent]: state }
    })),

  setRecommendations: (recommendations) => set({ recommendations }),

  selectChart: (config) => set({ selectedChart: config }),

  setDataProfile: (profile) => set({ dataProfile: profile }),

  setPatterns: (patterns) => set({ patterns }),

  setCurrentDatasetId: (id) => set({ currentDatasetId: id }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  // New method to start analysis with the backend
  startAnalysis: async (data: Array<Record<string, any>>, filename?: string) => {
    const { setLoading, setError, setCurrentDatasetId, updateAgentState } = get();

    setLoading(true);
    setError(null);
    updateAgentState('profiler', 'idle');
    updateAgentState('pattern', 'idle');
    updateAgentState('recommender', 'idle');

    try {
      const response = await backendAPI.analyzeDataset({
        data,
        filename: filename || 'dataset.csv',
        file_type: 'csv'
      });

      setCurrentDatasetId(response.dataset_id);

      // Start polling for status updates
      get().pollAnalysisStatus(response.dataset_id);

    } catch (error) {
      console.error('Analysis start failed:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
      setLoading(false);
    }
  },

  // Poll for analysis status updates
  pollAnalysisStatus: async (datasetId: string) => {
    const { updateAgentState, setLoading, setError, loadAnalysisResults } = get();

    try {
      const status = await backendAPI.getAnalysisStatus(datasetId);

      // Update agent states based on progress
      if (status.progress) {
        updateAgentState('profiler', status.progress.profiler ? 'completed' : 'running');
        updateAgentState('pattern', status.progress.recommender ? 'completed' : status.progress.profiler ? 'running' : 'idle');
        updateAgentState('recommender', status.progress.validator ? 'completed' : status.progress.recommender ? 'running' : 'idle');
      }

      // If analysis is completed, load results
      if (status.status === 'completed') {
        await loadAnalysisResults(datasetId);
        setLoading(false);
      } else if (status.status === 'failed') {
        setError('Analysis failed');
        setLoading(false);
      } else {
        // Continue polling if still processing
        setTimeout(() => get().pollAnalysisStatus(datasetId), 2000);
      }

    } catch (error) {
      console.error('Status polling failed:', error);
      setError('Failed to get analysis status');
      setLoading(false);
    }
  },

  // Load analysis results when completed
  loadAnalysisResults: async (datasetId: string) => {
    const { setRecommendations, setDataProfile, setError } = get();

    try {
      const results = await backendAPI.getAnalysisResults(datasetId);

      if (results.recommendations) {
        setRecommendations(results.recommendations);
      }

      if (results.data_profile) {
        setDataProfile(results.data_profile);
      }

    } catch (error) {
      console.error('Failed to load analysis results:', error);
      setError('Failed to load analysis results');
    }
  },

  // Reset analysis state
  resetAnalysis: () => set({
    currentDatasetId: null,
    isLoading: false,
    error: null,
    agentStates: {
      profiler: 'idle',
      pattern: 'idle',
      recommender: 'idle'
    },
    recommendations: null,
    dataProfile: null,
    patterns: null,
    selectedChart: null
  })
}));