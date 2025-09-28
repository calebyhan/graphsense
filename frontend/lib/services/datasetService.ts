import { supabase } from '@/lib/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DatasetMetadata {
  columns: number;
  rows: number;
  dataTypes: {
    numerical: number;
    categorical: number;
    temporal: number;
    geographic: number;
  };
  preview: string[];
  sample_data: Array<Record<string, any>>;
  data_profile?: any;
  original_filename?: string;
  file_info?: {
    size_bytes: number;
    upload_time: string;
    content_type: string;
  };
  processing_info?: {
    started_at?: string;
    completed_at?: string;
    error_message?: string;
    processing_duration_ms?: number;
  };
}

export class DatasetService {
  /**
   * Create a new dataset with pending status (supports null userId for dev mode)
   * Includes duplicate prevention by checking for existing datasets with the same filename
   */
  static async createDataset(params: {
    userId: string | null;
    filename: string;
    fileSize: number;
    fileType: string;
    initialMetadata?: Partial<DatasetMetadata>;
  }): Promise<Tables<'datasets'>> {
    const { userId, filename, fileSize, fileType, initialMetadata = {} } = params;

    // First, check if a dataset with this filename already exists for this user
    let existingQuery = supabase
      .from('datasets')
      .select('id, filename')
      .eq('filename', filename);
      
    if (userId === null) {
      existingQuery = existingQuery.is('user_id', null);
    } else {
      existingQuery = existingQuery.eq('user_id', userId);
    }
    
    const { data: existing, error: checkError } = await existingQuery.maybeSingle();
    
    // Only throw if we actually found a duplicate (ignore query errors for now)
    if (existing && !checkError) {
      console.log('Dataset with filename already exists:', filename, 'ID:', existing.id);
      throw new Error(`Dataset with filename "${filename}" already exists`);
    }
    
    if (checkError) {
      console.warn('Warning: Could not check for duplicates:', checkError.message);
    }

    const datasetInsert: TablesInsert<'datasets'> = {
      user_id: userId,
      filename,
      file_size: fileSize,
      file_type: fileType,
      processing_status: 'pending',
      metadata: {
        ...initialMetadata,
        file_info: {
          size_bytes: fileSize,
          upload_time: new Date().toISOString(),
          content_type: fileType,
          ...initialMetadata.file_info,
        },
      },
    };

    const { data, error } = await supabase
      .from('datasets')
      .insert(datasetInsert)
      .select()
      .single();

    if (error) {
      console.error('Failed to create dataset:', error);
      throw error;
    }

    console.log('Dataset created with pending status:', data.id);
    return data;
  }

  /**
   * Update dataset processing status
   */
  static async updateProcessingStatus(
    datasetId: string,
    status: ProcessingStatus,
    errorMessage?: string
  ): Promise<void> {
    const updateData: TablesUpdate<'datasets'> = {
      processing_status: status,
    };

    // Update metadata with processing info
    if (status === 'processing') {
      updateData.metadata = {
        processing_info: {
          started_at: new Date().toISOString(),
        },
      };
    } else if (status === 'completed' || status === 'failed') {
      // Get current metadata to preserve existing data
      const { data: currentDataset } = await supabase
        .from('datasets')
        .select('metadata')
        .eq('id', datasetId)
        .single();

      const currentMetadata = (currentDataset?.metadata as unknown as DatasetMetadata) || {};
      const processingInfo = currentMetadata.processing_info || {};

      updateData.metadata = {
        ...currentMetadata,
        processing_info: {
          ...processingInfo,
          completed_at: new Date().toISOString(),
          ...(processingInfo.started_at && {
            processing_duration_ms: Date.now() - new Date(processingInfo.started_at).getTime(),
          }),
          ...(errorMessage && { error_message: errorMessage }),
        },
      };
    }

    const { error } = await supabase
      .from('datasets')
      .update(updateData)
      .eq('id', datasetId);

    if (error) {
      console.error(`Failed to update dataset status to ${status}:`, error);
      throw error;
    }

    console.log(`Dataset ${datasetId} status updated to: ${status}`);
  }

  /**
   * Update dataset with processed data and metadata
   */
  static async updateWithProcessedData(
    datasetId: string,
    processedData: {
      rawData: Array<Record<string, any>>;
      dataProfile?: any;
      metadata: Partial<DatasetMetadata>;
    }
  ): Promise<void> {
    const { rawData, dataProfile, metadata } = processedData;

    // Get current metadata to preserve existing data
    const { data: currentDataset, error: fetchError } = await supabase
      .from('datasets')
      .select('metadata')
      .eq('id', datasetId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch current dataset metadata:', fetchError);
      throw fetchError;
    }

    const currentMetadata = (currentDataset?.metadata as unknown as DatasetMetadata) || {};

    // Merge metadata with existing data
    const updatedMetadata: DatasetMetadata = {
      ...currentMetadata,
      ...metadata,
      sample_data: rawData.slice(0, 1000), // Store sample data (first 1000 rows)
      data_profile: dataProfile,
      processing_info: {
        ...currentMetadata.processing_info,
        completed_at: new Date().toISOString(),
        ...(currentMetadata.processing_info?.started_at && {
          processing_duration_ms: Date.now() - new Date(currentMetadata.processing_info.started_at).getTime(),
        }),
      },
    };

    const { error } = await supabase
      .from('datasets')
      .update({
        processing_status: 'completed',
        metadata: updatedMetadata as any,
      })
      .eq('id', datasetId);

    if (error) {
      console.error('Failed to update dataset with processed data:', error);
      throw error;
    }

    console.log('Dataset updated with processed data:', datasetId);
  }

  /**
   * Get dataset by ID with user validation
   */
  static async getDataset(datasetId: string, userId: string): Promise<Tables<'datasets'> | null> {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Failed to fetch dataset:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get all datasets for a user (or null user for dev mode)
   */
  static async getUserDatasets(userId: string | null): Promise<Tables<'datasets'>[]> {
    let query = supabase
      .from('datasets')
      .select('*');
      
    if (userId === null) {
      // Dev mode: get datasets where user_id is null
      query = query.is('user_id', null);
    } else {
      // Normal mode: get datasets for specific user
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch user datasets:', error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} datasets for user:`, userId || 'null (dev mode)');
    return data || [];
  }

  /**
   * Delete dataset and all related data (supports null userId for dev mode)
   */
  static async deleteDataset(datasetId: string, userId: string | null): Promise<void> {
    let query = supabase
      .from('datasets')
      .delete()
      .eq('id', datasetId);
      
    if (userId === null) {
      // Dev mode: delete where user_id is null
      query = query.is('user_id', null);
    } else {
      // Normal mode: delete for specific user
      query = query.eq('user_id', userId);
    }
    
    const { error } = await query;

    if (error) {
      console.error('Failed to delete dataset:', error);
      throw error;
    }

    console.log('Dataset deleted:', datasetId);
  }

  /**
   * Get datasets by processing status
   */
  static async getDatasetsByStatus(
    userId: string,
    status: ProcessingStatus
  ): Promise<Tables<'datasets'>[]> {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('user_id', userId)
      .eq('processing_status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Failed to fetch datasets with status ${status}:`, error);
      throw error;
    }

    return data || [];
  }

  /**
   * Check if dataset exists and belongs to user
   */
  static async datasetExists(datasetId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('datasets')
      .select('id')
      .eq('id', datasetId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to check dataset existence:', error);
      throw error;
    }

    return !!data;
  }

  /**
   * Update dataset metadata without changing processing status
   */
  static async updateMetadata(
    datasetId: string,
    userId: string,
    metadata: Partial<DatasetMetadata>
  ): Promise<void> {
    // Get current metadata
    const { data: currentDataset, error: fetchError } = await supabase
      .from('datasets')
      .select('metadata')
      .eq('id', datasetId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch current metadata:', fetchError);
      throw fetchError;
    }

    const currentMetadata = (currentDataset?.metadata as unknown as DatasetMetadata) || {};

    // Merge metadata
    const updatedMetadata = {
      ...currentMetadata,
      ...metadata,
    };

    const { error } = await supabase
      .from('datasets')
      .update({ metadata: updatedMetadata })
      .eq('id', datasetId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update dataset metadata:', error);
      throw error;
    }

    console.log('Dataset metadata updated:', datasetId);
  }
}