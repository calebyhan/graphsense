/**
 * React Query hooks for backend API operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { backendAPI, AnalysisRequest, AnalysisResponse, AnalysisStatus } from './backendClient'

// Query Keys
export const queryKeys = {
  health: ['health'] as const,
  detailedHealth: ['health', 'detailed'] as const,
  datasets: (params?: { limit?: number; offset?: number }) => ['datasets', params] as const,
  analysisStatus: (datasetId: string) => ['analysis', 'status', datasetId] as const,
  analysisResults: (datasetId: string) => ['analysis', 'results', datasetId] as const,
  sharedVisualization: (shareToken: string) => ['visualization', 'shared', shareToken] as const,
}

// Health Check Hooks
export function useHealthCheck() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => backendAPI.healthCheck(),
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 15000, // Consider fresh for 15 seconds
    retry: (failureCount, error: any) => {
      // Don't retry if it's a 404 or 500, but retry network errors
      if (error?.status >= 400 && error?.status < 500) return false
      return failureCount < 3
    },
  })
}

export function useDetailedHealthCheck() {
  return useQuery({
    queryKey: queryKeys.detailedHealth,
    queryFn: () => backendAPI.detailedHealthCheck(),
    refetchInterval: 30000, // Poll every 30 seconds  
    staleTime: 15000, // Consider fresh for 15 seconds
    retry: (failureCount, error: any) => {
      // Don't retry if it's a 404 or 500, but retry network errors
      if (error?.status >= 400 && error?.status < 500) return false
      return failureCount < 3
    },
  })
}

export function useBackendAvailability() {
  return useQuery({
    queryKey: ['backend', 'availability'],
    queryFn: () => backendAPI.isAvailable(),
    refetchInterval: 30000,
    staleTime: 15000,
    retry: 1,
  })
}

// Dataset Hooks
export function useDatasets(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.datasets(params),
    queryFn: () => backendAPI.getDatasets(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Analysis Hooks
export function useAnalysisStatus(datasetId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analysisStatus(datasetId),
    queryFn: () => backendAPI.getAnalysisStatus(datasetId),
    enabled: enabled && !!datasetId,
    refetchInterval: (data) => {
      // Poll every 2 seconds if analysis is in progress
      if (data && data.status === 'processing') return 2000
      // Otherwise check every 10 seconds
      return 10000
    },
    staleTime: 1000, // Very short staletime for real-time updates
  })
}

export function useAnalysisResults(datasetId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analysisResults(datasetId),
    queryFn: () => backendAPI.getAnalysisResults(datasetId),
    enabled: enabled && !!datasetId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useAnalyzeDataset() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (request: AnalysisRequest) => backendAPI.analyzeDataset(request),
    onSuccess: (data, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.datasets() })
      
      if (data.dataset_id) {
        // Start polling the analysis status
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.analysisStatus(data.dataset_id) 
        })
      }
    },
  })
}

// Visualization Hooks  
export function useSharedVisualization(shareToken: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sharedVisualization(shareToken),
    queryFn: () => backendAPI.getSharedVisualization(shareToken),
    enabled: enabled && !!shareToken,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1, // Don't retry much for shared content
  })
}

export function useShareVisualization() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (visualizationId: string) => backendAPI.shareVisualization(visualizationId),
    onSuccess: (data, visualizationId) => {
      // Optionally cache the shared visualization data
      if (data.shareToken) {
        queryClient.setQueryData(
          queryKeys.sharedVisualization(data.shareToken),
          data
        )
      }
    },
  })
}