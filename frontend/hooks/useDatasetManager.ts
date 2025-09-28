import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import Papa from 'papaparse';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { Tables, TablesInsert } from '@/lib/supabase/types';
import { Dataset } from '@/components/AutoVizAgent';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { DatasetService, DatasetMetadata, ProcessingStatus } from '@/lib/services/datasetService';
import { useErrorHandler } from '@/lib/services/errorHandler';

interface DatasetManagerOptions {
  onDatasetCreated?: (dataset: Dataset) => void;
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
}

export function useDatasetManager(options: DatasetManagerOptions = {}) {
  const queryClient = useQueryClient();
  const { user, ensureAuth } = useAuthContext();
  const { handleError } = useErrorHandler();

  // Query to get datasets from Supabase
  const { data: datasets = [], isLoading, error } = useQuery({
    queryKey: ['datasets', user?.id || 'dev-user'],
    queryFn: async (): Promise<Dataset[]> => {
      console.log('📁 Loading datasets... User:', user?.id || 'dev-user (null treated as dev)');

      // Check if Supabase is properly configured
      if (!isSupabaseConfigured()) {
        console.log('⚠️ Supabase not configured, falling back to localStorage');
        return loadDatasetsFromLocalStorage();
      }

      // For dev purposes, use null user_id to get datasets without authentication
      const userId = user?.id || null;
      console.log('🔐 Using user ID for dataset query:', userId || 'null (dev mode)');

      // Fetch datasets using the service
      try {
        const dbDatasets = await DatasetService.getUserDatasets(userId);

        // Transform database datasets to frontend format
        const transformedDatasets: Dataset[] = dbDatasets.map((dbDataset: DatabaseDataset) => {
          const metadata = (dbDataset.metadata as unknown as DatasetMetadata) || {} as DatasetMetadata;

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
            data: metadata.sample_data || [], // Store sample data in metadata
            // Add processing status info
            ...(dbDataset.processing_status && {
              processingStatus: dbDataset.processing_status as ProcessingStatus
            })
          };
        });

        console.log('📁 Loaded datasets from Supabase:', transformedDatasets);
        return transformedDatasets;
      } catch (error) {
        console.error('Error loading datasets:', error);
        const dbError = handleError(error);
        throw new Error(dbError.userMessage);
      }
    },
    enabled: true, // Always enabled now that we support null user IDs for dev mode
    initialData: [],
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Mutation to create a new dataset with lifecycle support
  const createDatasetWithLifecycleMutation = useMutation({
    mutationFn: async (params: CreateDatasetWithLifecycleParams): Promise<Dataset> => {
      const { file, onProgress, onStatusChange } = params;

      console.log('🔥 Creating dataset with lifecycle for file:', file.name);

      // Get user ID (null for dev mode)
      const userId = user?.id || null;
      console.log('🔥 Creating dataset for user:', userId || 'null (dev mode)');

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

        console.log('✅ Dataset created with full lifecycle:', newDataset);
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
      }
    },
    onSuccess: (newDataset) => {
      console.log('🎉 Dataset created with lifecycle:', newDataset);

      // Update React Query cache
      queryClient.setQueryData(['datasets', user?.id || 'dev-user'], (oldData: Dataset[] | undefined) => {
        const current = oldData || [];
        const exists = current.some(d => d.id === newDataset.id);
        if (!exists) {
          return [newDataset, ...current];
        }
        return current;
      });

      // Invalidate and refetch datasets query
      queryClient.invalidateQueries({ queryKey: ['datasets', user?.id || 'dev-user'] });

      // Call callback if provided
      options.onDatasetCreated?.(newDataset);

      console.log('✅ Dataset created successfully with full lifecycle:', newDataset);
    },
    onError: (error) => {
      console.error('❌ Failed to create dataset with lifecycle:', error);
      const dbError = handleError(error);
      console.error('Processed error:', dbError);
    },
  });

  // Legacy mutation for direct data creation (maintains backward compatibility)
  const createDatasetMutation = useMutation({
    mutationFn: async (params: CreateDatasetParams): Promise<Dataset> => {
      const { rawData, dataProfile, filename } = params;

      console.log('🔥 Creating dataset directly with data:', {
        hasRawData: !!rawData,
        rawDataLength: rawData?.length,
        hasDataProfile: !!dataProfile,
        filename
      });

      if (!rawData || rawData.length === 0) {
        throw new Error('No raw data provided');
      }

      // Get user ID (null for dev mode)
      const userId = user?.id || null;
      console.log('🔥 Creating legacy dataset for user:', userId || 'null (dev mode)');

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

      console.log('Created new dataset directly:', newDataset);
      return newDataset;
    },
    onSuccess: (newDataset) => {
      console.log('🎉 MUTATION SUCCESS - Dataset created in Supabase:', newDataset);

      // Update React Query cache with the new dataset
      queryClient.setQueryData(['datasets'], (oldData: Dataset[] | undefined) => {
        const current = oldData || [];
        const exists = current.some(d => d.id === newDataset.id);
        if (!exists) {
          return [newDataset, ...current];
        }
        return current;
      });

      // Invalidate and refetch datasets query to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['datasets'] });

      // Call callback if provided
      options.onDatasetCreated?.(newDataset);

      console.log('✅ Dataset created successfully and cache updated:', newDataset);
    },
    onError: (error) => {
      console.error('Failed to create dataset:', error);
      const dbError = handleError(error);
      console.error('Processed error:', dbError);
    },
  });


  // Mutation to remove dataset using service
  const removeDatasetMutation = useMutation({
    mutationFn: async (datasetId: string) => {
      console.log('🗑️ Removing dataset:', datasetId);

      // Ensure user is authenticated
      // Get user ID (null for dev mode)
      const userId = user?.id || null;
      console.log('🗑️ Deleting dataset for user:', userId || 'null (dev mode)');

      // Delete using service (handles cascade deletion)
      await DatasetService.deleteDataset(datasetId, userId);

      console.log('✅ Dataset deleted successfully');
      return datasetId;
    },
    onSuccess: (deletedId) => {
      // Update React Query cache
      queryClient.setQueryData(['datasets', user?.id || 'dev-user'], (oldData: Dataset[] | undefined) => {
        return (oldData || []).filter(d => d.id !== deletedId);
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['datasets', user?.id || 'dev-user'] });
      queryClient.invalidateQueries({ queryKey: ['visualizations'] });

      console.log('✅ Dataset removed from cache:', deletedId);
    },
    onError: (error) => {
      console.error('Failed to remove dataset:', error);
      const dbError = handleError(error);
      console.error('Processed error:', dbError);
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
    const userId = user?.id || null;
    console.log('📊 Updating dataset status for user:', userId || 'null (dev mode)');

    await DatasetService.updateProcessingStatus(datasetId, status, errorMessage);

    // Invalidate cache to refetch data
    queryClient.invalidateQueries({ queryKey: ['datasets', userId || 'dev-user'] });
  }, [user?.id, queryClient]);

  return {
    datasets,
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

function formatDate(dateString: string): string {
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

    console.log('parseCSVText: Successfully parsed', results.data.length, 'rows');
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
    const parsedDatasets = stored ? JSON.parse(stored) : [];
    console.log('📁 Loaded datasets from localStorage:', parsedDatasets);
    return parsedDatasets;
  } catch (error) {
    console.error('Failed to load datasets from localStorage:', error);
    return [];
  }
}
