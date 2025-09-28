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

export type ErrorType = 'rate_limit' | 'timeout' | 'network' | 'general';

interface ExtendedAnalysisStore extends AnalysisStore {
  errorType: ErrorType | null;
  agentTimeouts: Record<keyof AgentState, number>; // Track when agents started running
  showErrorNotification: boolean;
  retryAttempts: number;
  setErrorType: (errorType: ErrorType | null) => void;
  setShowErrorNotification: (show: boolean) => void;
  retryAnalysis: () => void;
}

const AGENT_TIMEOUT_DURATION = 120000; // 2 minutes
const MAX_RETRY_ATTEMPTS = 3;

export const useAnalysisStore = create<ExtendedAnalysisStore>((set, get) => ({
  rawData: null,
  parsedData: null,
  agentStates: {
    profiler: 'idle',
    recommender: 'idle',
    validator: 'idle'
  },
  dataProfile: null,
  patterns: null,
  recommendations: null,
  selectedChart: null,
  currentDatasetId: null,
  isLoading: false,
  error: null,
  errorType: null,
  agentTimeouts: {
    profiler: 0,
    recommender: 0,
    validator: 0
  },
  showErrorNotification: false,
  retryAttempts: 0,

  setRawData: (data) => set({ rawData: data, parsedData: data }),

  updateAgentState: (agent, state) =>
    set((prev) => {
      const newTimeouts = { ...prev.agentTimeouts };
      
      // Track when agents start running for timeout detection
      if (state === 'running' && prev.agentStates[agent] !== 'running') {
        newTimeouts[agent] = Date.now();
      } else if (state !== 'running') {
        newTimeouts[agent] = 0;
      }
      
      return {
        agentStates: { ...prev.agentStates, [agent]: state },
        agentTimeouts: newTimeouts
      };
    }),

  setRecommendations: (recommendations) => set({ recommendations }),

  selectChart: (config) => set({ selectedChart: config }),

  setDataProfile: (profile) => set({ dataProfile: profile }),

  setPatterns: (patterns) => set({ patterns }),

  setCurrentDatasetId: (id) => set({ currentDatasetId: id }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setErrorType: (errorType) => set({ errorType, showErrorNotification: !!errorType }),

  setShowErrorNotification: (show) => set({ showErrorNotification: show }),

  retryAnalysis: () => {
    const { currentDatasetId, rawData, retryAttempts } = get();
    
    if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
      set({ 
        errorType: 'general', 
        error: 'Maximum retry attempts exceeded. Please try again later.',
        showErrorNotification: true 
      });
      return;
    }

    // Reset error state and retry
    set({ 
      errorType: null, 
      error: null, 
      showErrorNotification: false,
      retryAttempts: retryAttempts + 1 
    });
    
    if (currentDatasetId && rawData) {
      get().pollAnalysisStatus(currentDatasetId);
    } else if (rawData) {
      get().startAnalysis(rawData);
    }
  },

  // New method to start analysis with the backend
  startAnalysis: async (data: Array<Record<string, any>>, filename?: string) => {
    const { setCurrentDatasetId, setLoading, setError, updateAgentState } = get();

    try {
      setLoading(true);
      setError(null);
      
      // Reset agent states
      updateAgentState('profiler', 'idle');
      updateAgentState('recommender', 'idle');
      updateAgentState('validator', 'idle');

      const response = await backendAPI.analyzeDataset({ data, filename });
      
      if (response.success) {
        setCurrentDatasetId(response.dataset_id);
        
        // Start polling for status updates
        get().pollAnalysisStatus(response.dataset_id);
      } else {
        throw new Error(response.message || 'Analysis failed to start');
      }

    } catch (error) {
      console.error('Analysis failed to start:', error);
      setError(error instanceof Error ? error.message : 'Failed to start analysis');
      setLoading(false);
    }
  },

  // Poll for analysis status updates
  pollAnalysisStatus: async (datasetId: string) => {
    const { 
      updateAgentState, 
      setLoading, 
      setError, 
      setErrorType,
      loadAnalysisResults, 
      agentTimeouts,
      retryAttempts 
    } = get();

    try {
      // Check for agent timeouts before making the request
      const currentTime = Date.now();
      const runningAgents = Object.entries(get().agentStates).filter(([_, state]) => state === 'running');
      
      for (const [agentName, _] of runningAgents) {
        const startTime = agentTimeouts[agentName as keyof AgentState];
        if (startTime > 0 && (currentTime - startTime) > AGENT_TIMEOUT_DURATION) {
          console.warn(`Agent ${agentName} has been running for over ${AGENT_TIMEOUT_DURATION/1000} seconds`);
          setErrorType('timeout');
          return; // Stop polling and show timeout error
        }
      }

      const status = await backendAPI.getAnalysisStatus(datasetId);

      // Reset error state if request succeeded
      if (get().errorType === 'rate_limit' || get().errorType === 'network') {
        setErrorType(null);
        set({ retryAttempts: 0 }); // Reset retry counter on success
      }

      // Update agent states based on progress
      if (status.progress) {
        updateAgentState('profiler', status.progress.profiler ? 'complete' : 'running');
        updateAgentState('recommender', status.progress.recommender ? 'complete' : status.progress.profiler ? 'running' : 'idle');
        
        // Fix validator logic: if status is still "processing" and recommender is done but validator isn't, then validator is running
        if (status.progress.validator) {
          updateAgentState('validator', 'complete');
        } else if (status.progress.recommender && status.status === 'processing') {
          updateAgentState('validator', 'running');
        } else {
          updateAgentState('validator', 'idle');
        }
      }

      // If analysis is completed, load results
      if (status.status === 'completed') {
        await loadAnalysisResults(datasetId);
        setLoading(false);
      } else if (status.status === 'failed') {
        // Check if this is a rate limit failure by examining the progress
        // If profiler completed but recommender failed, it's likely a rate limit issue
        if (status.progress?.profiler && !status.progress?.recommender) {
          setError('AI service quota exceeded during chart recommendation phase');
          setErrorType('rate_limit');
        } else {
          setError('Analysis failed');
          setErrorType('general');
        }
        setLoading(false);
      } else if (status.status === 'processing') {
        // Continue polling if still processing
        setTimeout(() => get().pollAnalysisStatus(datasetId), 2000);
      } else {
        // Unknown status, continue polling with longer interval
        setTimeout(() => get().pollAnalysisStatus(datasetId), 5000);
      }

    } catch (error: any) {
      console.error('Status polling failed:', error);
      
      const errorMessage = error.message || error.toString() || '';
      
      // Detect various types of rate limiting and quota issues
      if (
        error.message?.includes('429') || 
        error.message?.includes('rate limit') ||
        errorMessage.includes('quota exceeded') ||
        errorMessage.includes('You exceeded your current quota') ||
        errorMessage.includes('generativelanguage.googleapis.com/generate_content_free_tier_requests') ||
        errorMessage.includes('Quota exceeded for metric') ||
        (error.status === 429) ||
        errorMessage.toLowerCase().includes('rate')
      ) {
        setErrorType('rate_limit');
        setError('AI service quota exceeded. Please wait for quota reset or upgrade your plan.');
        // Retry with exponential backoff for rate limits
        const backoffDelay = Math.min(5000 * Math.pow(2, retryAttempts), 60000); // Max 60s
        setTimeout(() => get().pollAnalysisStatus(datasetId), backoffDelay);
      } else if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('NetworkError')) {
        setErrorType('network');
        setError('Network connection failed');
        setLoading(false);
      } else {
        setErrorType('general');
        setError(errorMessage || 'Failed to get analysis status');
        setLoading(false);
      }
    }
  },

  // Load analysis results when completed
  loadAnalysisResults: async (datasetId: string) => {
    const { setRecommendations, setDataProfile, setError } = get();

    try {
      const results = await backendAPI.getAnalysisResults(datasetId);

      console.log('📊 Analysis results loaded:', results);

      if (results.recommendations) {
        setRecommendations(results.recommendations);
        console.log('✅ Recommendations set:', results.recommendations);
      }

      if (results.data_profile) {
        // Map backend data profile to frontend format
        const mappedProfile: DataProfile = {
          columns: [], // TODO: Map from backend format
          rowCount: results.data_profile.statistical_summary?.row_count || 0,
          dataQuality: 'medium' // TODO: Map from backend format
        };
        setDataProfile(mappedProfile);
        console.log('✅ Data profile set:', mappedProfile);
      }

      // IMPORTANT: Trigger dataset creation by ensuring rawData is still available
      // The rawData should already be set from the initial upload, but let's make sure
      const currentState = get();
      if (currentState.rawData) {
        console.log('✅ Raw data is available for dataset creation:', {
          rawDataLength: currentState.rawData.length,
          hasRecommendations: !!currentState.recommendations,
          hasDataProfile: !!currentState.dataProfile
        });
      } else {
        console.warn('⚠️ Raw data is missing - dataset creation may not work');
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
    errorType: null,
    showErrorNotification: false,
    retryAttempts: 0,
    agentStates: {
      profiler: 'idle',
      recommender: 'idle',
      validator: 'idle'
    },
    agentTimeouts: {
      profiler: 0,
      recommender: 0,
      validator: 0
    },
    recommendations: null,
    dataProfile: null,
    patterns: null,
    selectedChart: null
  })
}));