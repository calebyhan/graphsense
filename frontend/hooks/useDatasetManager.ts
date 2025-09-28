import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Dataset } from '@/components/AutoVizAgent';

interface DatasetManagerOptions {
  onDatasetCreated?: (dataset: Dataset) => void;
}

export function useDatasetManager(options: DatasetManagerOptions = {}) {
  const queryClient = useQueryClient();

  // Query to get datasets from localStorage
  const { data: datasets = [] } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      // Get datasets from localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('datasets');
        const parsedDatasets = stored ? JSON.parse(stored) : [];
        console.log('📁 Loading datasets from localStorage:', parsedDatasets);
        return parsedDatasets;
      }
      return [];
    },
    initialData: [],
  });

  // Mutation to create a new dataset
  const createDatasetMutation = useMutation({
    mutationFn: async (params: {
      rawData: Array<Record<string, any>>;
      dataProfile?: any;
      filename?: string;
    }) => {
      const { rawData, dataProfile, filename } = params;
      
      console.log('🔥 MUTATION CALLED - Creating dataset with params:', { 
        hasRawData: !!rawData, 
        rawDataLength: rawData?.length,
        hasDataProfile: !!dataProfile,
        filename
      });

      if (!rawData || rawData.length === 0) {
        throw new Error('No raw data provided');
      }

      const datasetId = `dataset-${Date.now()}`;
      
      // Calculate data types from actual data
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

      // Get current dataset count for naming
      const currentCount = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem('datasets') || '[]').length 
        : 0;

      const newDataset: Dataset = {
        id: datasetId,
        name: filename ? filename.replace(/\.[^/.]+$/, '') : `Dataset ${currentCount + 1}`,
        type: 'csv',
        columns: columns.length,
        rows: rawData.length,
        size: `${Math.round(JSON.stringify(rawData).length / 1024)}KB`,
        lastModified: 'Just now',
        dataTypes: {
          numerical,
          categorical,
          temporal,
          geographic: 0
        },
        preview: columns.slice(0, 5),
        data: rawData
      };

      console.log('Created new dataset:', newDataset);
      return newDataset;
    },
    onSuccess: (newDataset) => {
      console.log('🎉 MUTATION SUCCESS - Dataset created:', newDataset);
      
      // Update localStorage and React Query cache
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('datasets');
        const existingDatasets = stored ? JSON.parse(stored) : [];
        const exists = existingDatasets.some((d: Dataset) => d.id === newDataset.id);
        
        console.log('📊 Updating datasets state:', { 
          exists, 
          existingLength: existingDatasets.length, 
          newDatasetId: newDataset.id 
        });
        
        if (!exists) {
          const newState = [...existingDatasets, newDataset];
          localStorage.setItem('datasets', JSON.stringify(newState));
          console.log('📊 New datasets state saved to localStorage:', newState);
          
          // Update React Query cache
          queryClient.setQueryData(['datasets'], newState);
        }
      }

      // Invalidate and refetch datasets query
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      
      // Call callback if provided
      options.onDatasetCreated?.(newDataset);
      
      console.log('✅ Dataset created successfully and state updated:', newDataset);
    },
    onError: (error) => {
      console.error('Failed to create dataset:', error);
    },
  });

  // Function to create dataset
  const createDataset = useCallback((
    rawData: Array<Record<string, any>>, 
    dataProfile?: any,
    filename?: string
  ) => {
    return createDatasetMutation.mutate({ rawData, dataProfile, filename });
  }, [createDatasetMutation]);

  // Function to remove dataset
  const removeDataset = useCallback((datasetId: string) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('datasets');
      const existingDatasets = stored ? JSON.parse(stored) : [];
      const newState = existingDatasets.filter((d: Dataset) => d.id !== datasetId);
      localStorage.setItem('datasets', JSON.stringify(newState));
      queryClient.setQueryData(['datasets'], newState);
    }
    queryClient.invalidateQueries({ queryKey: ['datasets'] });
  }, [queryClient]);

  return {
    datasets,
    createDataset,
    removeDataset,
    isCreating: createDatasetMutation.isPending,
    createError: createDatasetMutation.error,
  };
}
