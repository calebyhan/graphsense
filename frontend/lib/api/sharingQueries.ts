/**
 * React Query hooks for sharing service operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SharingService, ShareOptions, SharedVisualization } from '@/lib/services/sharingService'

// Query Keys for sharing
export const sharingQueryKeys = {
  sharedVisualization: (token: string) => ['sharing', 'visualization', token] as const,
}

export function useShareVisualizationMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (options: ShareOptions) => SharingService.shareVisualization(options),
    onSuccess: (data, variables) => {
      // Cache the shared visualization data
      if (data.shareToken) {
        queryClient.setQueryData(
          sharingQueryKeys.sharedVisualization(data.shareToken),
          {
            shareToken: data.shareToken,
            shareUrl: data.shareUrl,
            chartConfig: variables.chartConfig,
            chartType: variables.chartType,
            title: variables.title,
            description: variables.description,
          }
        )
      }
    },
  })
}

export function useSharedVisualizationQuery(shareToken: string, enabled = true) {
  return useQuery({
    queryKey: sharingQueryKeys.sharedVisualization(shareToken),
    queryFn: () => SharingService.getSharedVisualization(shareToken),
    enabled: enabled && !!shareToken && SharingService.isValidShareToken(shareToken),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1, // Don't retry much for shared content
  })
}