import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { Tables, TablesInsert } from '@/lib/supabase/types';
import { Dataset } from '@/components/AutoVizAgent';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { DatasetService, DatasetMetadata, ProcessingStatus } from '@/lib/services/datasetService';
import { useErrorHandler } from '@/lib/services/errorHandler';

interface DatasetManagerOptions {
  onDatasetCreated?: (dataset: Dataset) => void;
  canvasId?: string;
}

type DatabaseDataset = Tables<'datasets'>;

interface CreateDatasetParams {
  rawData: Array<Record<string, any>>;
  dataProfile?: any;
  filename?: string;
}

interface CreateDatasetWithLifecycleParams {
  file: File;
  onProgress?: (progress: number) => void;
  onStatusChange?: (status: ProcessingStatus) => void;
  onDatasetCreated?: (dataset: Dataset) => void;
}

export function useDatasetManager(options: DatasetManagerOptions = {}) {
  const queryClient = useQueryClient();
  const { canvasId } = options;
  const { user, loading: authLoading, ensureAuth } = useAuthContext();
  const { handleError } = useErrorHandler();

  // Query to get datasets from Supabase - Enhanced for refresh scenarios
  const { data: datasets = [], isLoading, error, refetch } = useQuery({
    queryKey: canvasId ? ['datasets', 'canvas', canvasId] : ['datasets', user?.id || 'dev-user'],
    queryFn: async (): Promise<Dataset[]> => {
      // Check if Supabase is properly configured
      if (!isSupabaseConfigured()) {
        return loadDatasetsFromLocalStorage();
      }

      const userId = user?.id || null;

      // Fetch datasets using the service
      try {
        // When on a canvas, fetch all datasets linked to it (from all collaborators)
        const dbDatasets = canvasId
          ? await DatasetService.getCanvasDatasets(canvasId)
          : await DatasetService.getUserDatasets(userId);

        // Transform database datasets to frontend format
        const transformedDatasets: Dataset[] = await Promise.all(
          dbDatasets.map(async (dbDataset: DatabaseDataset) => {
            const metadata = (dbDataset.metadata as unknown as DatasetMetadata) || {} as DatasetMetadata;

            // Ensure we have actual data for completed datasets
            let actualData: any[] = [];
            if (dbDataset.processing_status === 'completed' && metadata.sample_data) {
              actualData = Array.isArray(metadata.sample_data) ? metadata.sample_data : [];
            }

            return {
              id: dbDataset.id,
              name: dbDataset.filename.replace(/\.[^/.]+$/, ''), // Remove file extension
              type: dbDataset.file_type as 'csv',
              columns: metadata.columns ?? 0,
              rows: metadata.rows ?? 0,
              size: formatFileSize(dbDataset.file_size),
              lastModified: formatDate(dbDataset.updated_at),
              dataTypes: metadata.dataTypes ?? {
                numerical: 0,
                categorical: 0,
                temporal: 0,
                geographic: 0
              },
              preview: metadata.preview ?? [],
              data: actualData, // Ensure data is available for completed datasets
              // Add processing status info
              ...(dbDataset.processing_status && {
                processingStatus: dbDataset.processing_status as ProcessingStatus
              })
            };
          })
        );

        return transformedDatasets;
      } catch (error) {
        console.error('Error loading datasets from Supabase:', error);
        const dbError = handleError(error);
        throw new Error(dbError.userMessage);
      }
    },
    enabled: !authLoading, // Wait for auth to resolve before fetching (avoids unauthenticated empty results)
    placeholderData: [], // Display while loading — unlike initialData, doesn't count as cached data
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: canvasId ? 15 * 1000 : 5 * 60 * 1000, // 15s for canvas (Realtime subscription handles live updates; poll is a safety net)
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always', // Force refetch on every mount regardless of cache
    // Realtime subscription handles live updates; 30s poll is a safety-net fallback
    refetchInterval: canvasId ? 30000 : false,
  });

  // Mutation to create a new dataset with lifecycle support
  const createDatasetWithLifecycleMutation = useMutation({
    mutationKey: ['createDatasetWithLifecycle'], // Add mutation key to prevent duplicates
    mutationFn: async (params: CreateDatasetWithLifecycleParams): Promise<Dataset> => {
      const { file, onProgress, onStatusChange } = params;

      const userId = user?.id || null;

      // Check if this mutation is already in progress (prevent React Strict Mode duplicates)
      const inProgressKey = `creating-${file.name}-${file.size}`;
      if (typeof window !== 'undefined' && (window as any)[inProgressKey]) {
        throw new Error('Upload already in progress for this file');
      }
      
      // Mark as in progress
      if (typeof window !== 'undefined') {
        (window as any)[inProgressKey] = true;
      }
      
      try {
        // Check if a dataset with this filename already exists to prevent duplicates.
        // Use canvas-scoped datasets when on a canvas so collaborators see each other's uploads.
        const existingDatasets = canvasId
          ? await DatasetService.getCanvasDatasets(canvasId)
          : await DatasetService.getUserDatasets(userId);
        const duplicateInCanvas = existingDatasets.find(d => d.filename === file.name);
        if (duplicateInCanvas) {
          // Clear in-progress flag before early return so the same file can be re-uploaded later
          if (typeof window !== 'undefined') {
            delete (window as any)[inProgressKey];
          }
          // Resolve progress/status callbacks so callers don't hang in a loading state
          onStatusChange?.('completed');
          onProgress?.(100);
          const metadata = (duplicateInCanvas.metadata as unknown as DatasetMetadata) || {} as DatasetMetadata;
          return {
            id: duplicateInCanvas.id,
            name: file.name.replace(/\.[^/.]+$/, ''),
            type: 'csv',
            columns: metadata.columns ?? 0,
            rows: metadata.rows ?? 0,
            size: formatFileSize(duplicateInCanvas.file_size),
            lastModified: formatDate(duplicateInCanvas.updated_at),
            dataTypes: metadata.dataTypes ?? {
              numerical: 0,
              categorical: 0,
              temporal: 0,
              geographic: 0
            },
            preview: metadata.preview ?? [],
            data: Array.isArray(metadata.sample_data) ? metadata.sample_data : [],
            processingStatus: duplicateInCanvas.processing_status as ProcessingStatus
          };
        }

        // When on a canvas with an authenticated user, check if this file already exists globally
        // (uploaded to a different canvas). Match on both filename AND file size to avoid silently
        // returning the wrong dataset when the user re-uses a filename for different data.
        // Only reuse a dataset that has completed processing — failed/pending ones should be
        // re-created so the user isn't stuck with a broken import.
        // Skip this check in dev mode (userId null): getUserDatasets(null) returns all rows
        // where user_id IS NULL, which could include datasets created by other anonymous
        // sessions on the same instance. Without a user identity there is no safe way to
        // determine ownership, so always create a fresh row instead.
        if (canvasId && userId) {
          // Wrap in try/catch so a transient fetch failure here degrades gracefully
          // (skip the global dedup, proceed to upload) rather than aborting the entire
          // upload with a confusing error message.
          let userDatasets: Tables<'datasets'>[] = [];
          try {
            userDatasets = await DatasetService.getUserDatasets(userId);
          } catch (dedupeError) {
            console.error('useDatasetManager: global dedup check failed, proceeding with upload:', dedupeError);
          }
          const globalDuplicate = userDatasets.find(
            d => d.filename === file.name &&
                 d.file_size === file.size &&
                 d.processing_status === 'completed'
          );
          if (globalDuplicate) {
            if (typeof window !== 'undefined') {
              delete (window as any)[inProgressKey];
            }
            await DatasetService.linkDatasetToCanvas(globalDuplicate.id, canvasId);
            // Resolve progress/status callbacks so callers don't hang in a loading state
            onStatusChange?.('completed');
            onProgress?.(100);
            const metadata = (globalDuplicate.metadata as unknown as DatasetMetadata) || {} as DatasetMetadata;
            return {
              id: globalDuplicate.id,
              name: file.name.replace(/\.[^/.]+$/, ''),
              type: 'csv',
              columns: metadata.columns ?? 0,
              rows: metadata.rows ?? 0,
              size: formatFileSize(globalDuplicate.file_size),
              lastModified: formatDate(globalDuplicate.updated_at),
              dataTypes: metadata.dataTypes ?? {
                numerical: 0,
                categorical: 0,
                temporal: 0,
                geographic: 0
              },
              preview: metadata.preview ?? [],
              data: Array.isArray(metadata.sample_data) ? metadata.sample_data : [],
              processingStatus: globalDuplicate.processing_status as ProcessingStatus
            };
          }
        }

        // Step 1: Create dataset with pending status
      onStatusChange?.('pending');
      onProgress?.(10);

      const dbDataset = await DatasetService.createDataset({
        userId,
        filename: file.name,
        fileSize: file.size,
        fileType: file.type || 'text/csv',
      });

      onProgress?.(20);

      try {
        // Step 2: Update status to processing
        await DatasetService.updateProcessingStatus(dbDataset.id, 'processing');
        onStatusChange?.('processing');
        onProgress?.(30);

        // Step 3: Parse file content
        const text = await file.text();
        onProgress?.(50);

        // Step 4: Process CSV data (simplified)
        const rawData = parseCSVText(text);
        onProgress?.(70);

        if (!rawData || rawData.length === 0) {
          throw new Error('No data found in file');
        }

        // Step 5: Analyze data
        const dataAnalysis = analyzeData(rawData);
        onProgress?.(90);

        // Step 6: Update with processed data
        await DatasetService.updateWithProcessedData(dbDataset.id, {
          rawData,
          metadata: dataAnalysis.metadata,
          dataProfile: dataAnalysis.profile,
        });

        // Step 7: Link to canvas — do this before returning so failures are surfaced atomically
        if (canvasId && userId) {
          await DatasetService.linkDatasetToCanvas(dbDataset.id, canvasId);
        } else if (canvasId && !userId) {
          console.warn(
            'useDatasetManager: dataset created on canvas but not linked — userId is null (dev mode). ' +
            'Dataset will disappear after the next refetch because no canvas_datasets row was created.'
          );
        }

        onStatusChange?.('completed');
        onProgress?.(100);

        // Transform to frontend format
        const newDataset: Dataset = {
          id: dbDataset.id,
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: 'csv',
          columns: dataAnalysis.metadata.columns ?? 0,
          rows: dataAnalysis.metadata.rows ?? 0,
          size: formatFileSize(file.size),
          lastModified: 'Just now',
          dataTypes: dataAnalysis.metadata.dataTypes ?? {
            numerical: 0,
            categorical: 0,
            temporal: 0,
            geographic: 0
          },
          preview: dataAnalysis.metadata.preview ?? [],
          data: rawData, // Keep full data in memory for current session
          processingStatus: 'completed'
        };

        return newDataset;
      } catch (error) {
        // Mark as failed if any step fails
        await DatasetService.updateProcessingStatus(
          dbDataset.id,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
        onStatusChange?.('failed');
        throw error;
      } finally {
        // Clear the in-progress flag regardless of success or failure
        if (typeof window !== 'undefined') {
          delete (window as any)[inProgressKey];
        }
      }
    } catch (error) {
      // Covers failures before the inner try (e.g. createDataset() throwing) where
      // the inner finally has not yet run. Always clear the flag so the same file
      // can be re-uploaded without a page refresh.
      if (typeof window !== 'undefined') {
        delete (window as any)[inProgressKey];
      }
      throw error;
    }
    },
    onSuccess: (newDataset, variables) => {
      const cacheKey = canvasId ? ['datasets', 'canvas', canvasId] : ['datasets', user?.id || 'dev-user'];

      // Update React Query cache (avoid duplicates by checking ID)
      queryClient.setQueryData(cacheKey, (oldData: Dataset[] | undefined) => {
        const current = oldData || [];
        const exists = current.some(d => d.id === newDataset.id);
        if (!exists) {
          return [newDataset, ...current];
        } else {
          return current.map(d => d.id === newDataset.id ? newDataset : d);
        }
      });

      // Prevent excessive invalidation that can cause duplicates
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: cacheKey });
      }, 100);

      // Two separate callback paths are intentional:
      // - options.onDatasetCreated: registered at hook instantiation (e.g. DataPanel)
      // - variables.onDatasetCreated: passed per-call (e.g. AutoVizAgent)
      // They serve different consumers; dedupe is handled by the callers.
      if (options.onDatasetCreated) {
        setTimeout(() => options.onDatasetCreated?.(newDataset), 0);
      }
      if (variables.onDatasetCreated) {
        setTimeout(() => variables.onDatasetCreated?.(newDataset), 0);
      }

    },
    onError: (error) => {
      console.error('Failed to create dataset with lifecycle:', error);
      handleError(error);
    },
  });

  // Legacy mutation for direct data creation (maintains backward compatibility)
  const createDatasetMutation = useMutation({
    mutationKey: ['createDataset'], // Add mutation key to prevent duplicates
    mutationFn: async (params: CreateDatasetParams): Promise<Dataset> => {
      const { rawData, dataProfile, filename } = params;

      if (!rawData || rawData.length === 0) {
        throw new Error('No raw data provided');
      }

      const userId = user?.id || null;

      // Canvas-scoped dedup: if a completed dataset with this filename is already linked
      // to the current canvas, return it rather than re-running analysis and creating a
      // duplicate datasets row. Requiring 'completed' prevents returning a broken import
      // (failed/pending) when the user re-uploads to fix a previous failure.
      if (canvasId && filename) {
        const canvasDatasets = await DatasetService.getCanvasDatasets(canvasId);
        const existing = canvasDatasets.find(
          d => d.filename === filename && d.processing_status === 'completed'
        );
        if (existing) {
          const metadata = (existing.metadata as unknown as DatasetMetadata) || {} as DatasetMetadata;
          return {
            id: existing.id,
            name: filename.replace(/\.[^/.]+$/, ''),
            type: 'csv',
            columns: metadata.columns ?? 0,
            rows: metadata.rows ?? 0,
            size: formatFileSize(existing.file_size),
            lastModified: formatDate(existing.updated_at),
            dataTypes: metadata.dataTypes ?? { numerical: 0, categorical: 0, temporal: 0, geographic: 0 },
            preview: metadata.preview ?? [],
            data: Array.isArray(metadata.sample_data) ? metadata.sample_data : [],
            processingStatus: existing.processing_status as ProcessingStatus,
          };
        }
      }

      // Analyze the data
      const dataAnalysis = analyzeData(rawData);
      const dataSize = new Blob([JSON.stringify(rawData)]).size;

      // Create dataset with completed status since we have all the data
      const dbDataset = await DatasetService.createDataset({
        userId,
        filename: filename || `Dataset-${Date.now()}.csv`,
        fileSize: dataSize,
        fileType: 'csv',
        initialMetadata: dataAnalysis.metadata,
      });

      // Update with processed data
      await DatasetService.updateWithProcessedData(dbDataset.id, {
        rawData,
        dataProfile,
        metadata: dataAnalysis.metadata,
      });

      // Link to canvas — failures surface via onError so the user is informed
      if (canvasId && userId) {
        await DatasetService.linkDatasetToCanvas(dbDataset.id, canvasId);
      } else if (canvasId && !userId) {
        console.warn(
          'useDatasetManager: dataset created on canvas but not linked — userId is null (dev mode). ' +
          'Dataset will disappear after the next refetch because no canvas_datasets row was created.'
        );
      }

      // Transform to frontend format
      const newDataset: Dataset = {
        id: dbDataset.id,
        name: (filename || `Dataset-${Date.now()}`).replace(/\.[^/.]+$/, ''),
        type: 'csv',
        columns: dataAnalysis.metadata.columns ?? 0,
        rows: dataAnalysis.metadata.rows ?? 0,
        size: formatFileSize(dataSize),
        lastModified: 'Just now',
        dataTypes: dataAnalysis.metadata.dataTypes ?? {
          numerical: 0,
          categorical: 0,
          temporal: 0,
          geographic: 0
        },
        preview: dataAnalysis.metadata.preview ?? [],
        data: rawData, // Keep full data in memory for current session
        processingStatus: 'completed'
      };

      return newDataset;
    },
    onSuccess: (newDataset) => {
      const cacheKey = canvasId ? ['datasets', 'canvas', canvasId] : ['datasets', user?.id || 'dev-user'];

      // Update React Query cache with the new dataset (prevent duplicates)
      queryClient.setQueryData(cacheKey, (oldData: Dataset[] | undefined) => {
        const current = oldData || [];
        const exists = current.some(d => d.id === newDataset.id);
        if (!exists) {
          return [newDataset, ...current];
        } else {
          return current.map(d => d.id === newDataset.id ? newDataset : d);
        }
      });

      // Prevent excessive invalidation that can cause duplicates
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: cacheKey });
      }, 100);

      // Call callback if provided (debounced to prevent multiple calls)
      if (options.onDatasetCreated) {
        setTimeout(() => options.onDatasetCreated?.(newDataset), 0);
      }

    },
    onError: (error) => {
      console.error('Failed to create dataset:', error);
      handleError(error);
    },
  });


  // Mutation to remove dataset using service
  const removeDatasetMutation = useMutation({
    mutationFn: async (datasetId: string) => {
      const userId = user?.id || null;
      // When on a canvas, unlink from this canvas only. Hard-delete only if no other
      // canvases reference the dataset — avoids wiping a shared dataset from sibling canvases.
      if (canvasId) {
        await DatasetService.removeDatasetFromCanvas(datasetId, canvasId, userId);
      } else {
        await DatasetService.deleteDataset(datasetId, userId);
      }
      return datasetId;
    },
    onSuccess: (deletedId) => {
      const cacheKey = canvasId ? ['datasets', 'canvas', canvasId] : ['datasets', user?.id || 'dev-user'];
      queryClient.setQueryData(cacheKey, (oldData: Dataset[] | undefined) => {
        return (oldData || []).filter(d => d.id !== deletedId);
      });
      queryClient.invalidateQueries({ queryKey: cacheKey });
      queryClient.invalidateQueries({ queryKey: ['visualizations'] });
    },
    onError: (error) => {
      console.error('Failed to remove dataset:', error);
      handleError(error);
    },
  });

  // Function to create dataset with lifecycle
  const createDatasetWithLifecycle = useCallback((params: CreateDatasetWithLifecycleParams) => {
    return createDatasetWithLifecycleMutation.mutate(params);
  }, [createDatasetWithLifecycleMutation]);

  // Function to create dataset directly (legacy support)
  const createDataset = useCallback((rawData: Array<Record<string, any>>, dataProfile?: any, filename?: string) => {
    return createDatasetMutation.mutate({ rawData, dataProfile, filename });
  }, [createDatasetMutation]);

  // Function to remove dataset
  const removeDataset = useCallback((datasetId: string) => {
    return removeDatasetMutation.mutate(datasetId);
  }, [removeDatasetMutation]);

  // Function to update dataset status
  const updateDatasetStatus = useCallback(async (datasetId: string, status: ProcessingStatus, errorMessage?: string) => {
    await DatasetService.updateProcessingStatus(datasetId, status, errorMessage);
    const cacheKey = canvasId ? ['datasets', 'canvas', canvasId] : ['datasets', user?.id || 'dev-user'];
    queryClient.invalidateQueries({ queryKey: cacheKey });
  }, [canvasId, user?.id, queryClient]);

  // Add refresh functionality for manual data reload
  const refreshDatasets = useCallback(() => {
    return refetch();
  }, [refetch]);

  // Real-time subscription: invalidate canvas datasets when any collaborator links a new one.
  // IMPORTANT: Supabase Realtime must be in RLS mode (Realtime > Authorization in the dashboard)
  // for backend service-role inserts into canvas_datasets to propagate to subscribing clients.
  // If events are silently missing, check that the table is in the realtime publication
  // (ALTER PUBLICATION supabase_realtime ADD TABLE canvas_datasets) AND that RLS mode is enabled.
  useEffect(() => {
    if (!canvasId || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`canvas_datasets:${canvasId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'canvas_datasets', filter: `canvas_id=eq.${canvasId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['datasets', 'canvas', canvasId] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Don't throw — the 30 s polling fallback (refetchInterval) handles live updates.
          // Log so the failure is observable without requiring a Supabase dashboard check.
          console.error(`canvas_datasets realtime subscription failed (${status}):`, err);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [canvasId, queryClient]);

  // Auto-refresh datasets on page visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isSupabaseConfigured()) {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  return {
    datasets,
    refreshDatasets, // New function for manual refresh
    createDataset, // Legacy function
    createDatasetWithLifecycle, // New lifecycle-aware function
    removeDataset,
    updateDatasetStatus,
    isLoading,
    isCreating: createDatasetMutation.isPending,
    isCreatingWithLifecycle: createDatasetWithLifecycleMutation.isPending,
    isRemoving: removeDatasetMutation.isPending,
    createError: createDatasetMutation.error,
    createWithLifecycleError: createDatasetWithLifecycleMutation.error,
    removeError: removeDatasetMutation.error,
    error,
  };
}

// Helper functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;

  return date.toLocaleDateString();
}

function parseCSVText(text: string): Array<Record<string, any>> {
  if (!text || text.trim().length === 0) {
    console.warn('parseCSVText: Empty or null text provided');
    return [];
  }

  try {
    const results = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim()
    });

    if (results.errors.length > 0) {
      console.warn('parseCSVText: CSV parsing errors:', results.errors);
      // Don't throw here - just log warnings for minor issues
      const criticalErrors = results.errors.filter(err => 
        err.type === 'Delimiter' || err.type === 'Quotes'
      );
      if (criticalErrors.length > 0) {
        throw new Error(`CSV parsing error: ${criticalErrors.map(e => e.message).join(', ')}`);
      }
    }

    if (!results.data || results.data.length === 0) {
      console.warn('parseCSVText: No data found after parsing');
      return [];
    }

    return results.data as Array<Record<string, any>>;
  } catch (error) {
    console.error('parseCSVText: Failed to parse CSV:', error);
    throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function analyzeData(rawData: Array<Record<string, any>>): {
  metadata: Partial<DatasetMetadata>;
  profile: any;
} {
  if (!rawData || rawData.length === 0) {
    return {
      metadata: {
        columns: 0,
        rows: 0,
        dataTypes: { numerical: 0, categorical: 0, temporal: 0, geographic: 0 },
        preview: [],
      },
      profile: null,
    };
  }

  const columns = Object.keys(rawData[0] || {});
  let numerical = 0, categorical = 0, temporal = 0;

  columns.forEach(col => {
    const values = rawData.slice(0, 100).map(row => row[col]);
    const nonNullValues = values.filter(v => v != null && v !== '');

    if (nonNullValues.length === 0) return;

    // Check if numeric
    const numericValues = nonNullValues.filter(v => !isNaN(Number(v)));
    if (numericValues.length > nonNullValues.length * 0.8) {
      numerical++;
      return;
    }

    // Check if temporal
    const dateValues = nonNullValues.filter(v => {
      const str = String(v);
      return /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2}/.test(str);
    });
    if (dateValues.length > nonNullValues.length * 0.5) {
      temporal++;
      return;
    }

    categorical++;
  });

  const dataTypes = { numerical, categorical, temporal, geographic: 0 };

  return {
    metadata: {
      columns: columns.length,
      rows: rawData.length,
      dataTypes,
      preview: columns.slice(0, 5),
    },
    profile: {
      columnTypes: dataTypes,
      sampleRows: rawData.slice(0, 10),
      summary: {
        totalColumns: columns.length,
        totalRows: rawData.length,
        hasNumerical: numerical > 0,
        hasCategorical: categorical > 0,
        hasTemporal: temporal > 0,
      },
    },
  };
}

// Fallback function for localStorage when Supabase is not configured
function loadDatasetsFromLocalStorage(): Dataset[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem('datasets');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load datasets from localStorage:', error);
    return [];
  }
}
