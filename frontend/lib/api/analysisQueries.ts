/**
 * React Query hooks for analysis operations
 * Replaces the polling and state management in useAnalysisStore
 */

import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { backendAPI, AnalysisRequest } from './backendClient'

// Query Keys for analysis
export const analysisQueryKeys = {
  dataset: (datasetId: string) => ['analysis', 'dataset', datasetId] as const,
  status: (datasetId: string) => ['analysis', 'status', datasetId] as const,
  results: (datasetId: string) => ['analysis', 'results', datasetId] as const,
}

// Hook to start analysis (mutation)
export function useStartAnalysis() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ data, filename }: { data: Array<Record<string, any>>, filename?: string }) => 
      backendAPI.analyzeDataset({ data, filename }),
    onSuccess: (response) => {
      if (response.success && response.dataset_id) {
        // Invalidate and start polling the status
        queryClient.invalidateQueries({ 
          queryKey: analysisQueryKeys.status(response.dataset_id) 
        })
      }
    },
  })
}

// Hook to poll analysis status (query with polling)
export function useAnalysisStatus(datasetId: string | null, enabled = true) {
  return useQuery({
    queryKey: analysisQueryKeys.status(datasetId || ''),
    queryFn: () => backendAPI.getAnalysisStatus(datasetId!),
    enabled: enabled && !!datasetId,
    refetchInterval: (data) => {
      // Continue polling while analysis is in progress
      if (!data || data.status === 'processing') {
        return 2000 // Poll every 2 seconds while processing
      }
      if (data.status === 'completed' || data.status === 'failed') {
        return false // Stop polling when done
      }
      return 5000 // Default polling interval
    },
    staleTime: 0, // Always consider stale for real-time updates
    retry: (failureCount, error: any) => {
      // Handle rate limiting with exponential backoff
      if (error?.status === 429) {
        return failureCount < 5 // Retry rate limits up to 5 times
      }
      return failureCount < 3 // Standard retry for other errors
    },
    retryDelay: (attemptIndex, error: any) => {
      // Exponential backoff for rate limits
      if (error?.status === 429) {
        return Math.min(1000 * Math.pow(2, attemptIndex), 30000) // Max 30 second delay
      }
      return 1000 * attemptIndex // Standard delay
    }
  })
}

// Hook to get analysis results (query)
export function useAnalysisResults(datasetId: string | null, enabled = true) {
  return useQuery({
    queryKey: analysisQueryKeys.results(datasetId || ''),
    queryFn: () => backendAPI.getAnalysisResults(datasetId!),
    enabled: enabled && !!datasetId,
    staleTime: 5 * 60 * 1000, // Results are stable for 5 minutes
    retry: 1, // Don't retry results much
  })
}

// Composite hook that manages the full analysis lifecycle
export function useAnalysisLifecycle() {
  const queryClient = useQueryClient()
  const startAnalysis = useStartAnalysis()
  
  const currentDatasetId = startAnalysis.data?.dataset_id || null
  
  const statusQuery = useAnalysisStatus(
    currentDatasetId, 
    !!currentDatasetId && startAnalysis.isSuccess
  )
  
  const resultsQuery = useAnalysisResults(
    currentDatasetId,
    statusQuery.data?.status === 'completed'
  )

  // Derived state similar to the original store
  const agentStates = React.useMemo(() => {
    const progress = statusQuery.data?.progress
    if (!progress) {
      return {
        profiler: 'idle' as const,
        recommender: 'idle' as const, 
        validator: 'idle' as const
      }
    }

    return {
      profiler: progress.profiler ? 'complete' as const : 'running' as const,
      recommender: progress.recommender ? 'complete' as const : 
                   progress.profiler ? 'running' as const : 'idle' as const,
      validator: progress.validator ? 'complete' as const :
                progress.recommender && statusQuery.data?.status === 'processing' ? 'running' as const : 'idle' as const
    }
  }, [statusQuery.data])

  const isLoading = startAnalysis.isPending || 
                   (statusQuery.data?.status === 'processing' && !resultsQuery.data)

  const error = startAnalysis.error || statusQuery.error || resultsQuery.error

  return {
    // Actions
    startAnalysis: startAnalysis.mutate,
    
    // State
    currentDatasetId,
    agentStates,
    isLoading,
    error: error as Error | null,
    
    // Data
    analysisStatus: statusQuery.data,
    analysisResults: resultsQuery.data,
    
    // Raw queries for advanced usage
    startAnalysisMutation: startAnalysis,
    statusQuery,
    resultsQuery,
    
    // Helper methods
    reset: () => {
      startAnalysis.reset()
      if (currentDatasetId) {
        queryClient.invalidateQueries({ 
          queryKey: analysisQueryKeys.dataset(currentDatasetId) 
        })
      }
    }
  }
}