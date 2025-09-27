/**
 * Backend API Client
 * Handles communication with the Python FastAPI backend
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface AnalysisRequest {
  data: Array<Record<string, any>>;
  filename?: string;
  file_type?: string;
  options?: Record<string, any>;
}

export interface AnalysisResponse {
  success: boolean;
  dataset_id: string;
  recommendations?: Array<any>;
  data_profile?: any;
  processing_time_ms: number;
  message: string;
}

export interface AnalysisStatus {
  status: string;
  completed_agents?: string[];
  progress?: {
    profiler: boolean;
    recommender: boolean;
    validator: boolean;
  };
}

export class BackendAPIClient {
  private baseURL: string;

  constructor(baseURL: string = BACKEND_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Start dataset analysis using the 3-agent pipeline
   */
  async analyzeDataset(request: AnalysisRequest): Promise<AnalysisResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/analysis/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Analysis request failed:', error);
      throw error;
    }
  }

  /**
   * Get analysis status for a dataset
   */
  async getAnalysisStatus(datasetId: string): Promise<AnalysisStatus> {
    try {
      const response = await fetch(`${this.baseURL}/api/analysis/status/${datasetId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Status request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Status request failed:', error);
      throw error;
    }
  }

  /**
   * Get complete analysis results for a dataset
   */
  async getAnalysisResults(datasetId: string): Promise<AnalysisResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/analysis/results/${datasetId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Results request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Results request failed:', error);
      throw error;
    }
  }

  /**
   * Get datasets list
   */
  async getDatasets(params?: { limit?: number; offset?: number }): Promise<any> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.offset) searchParams.set('offset', params.offset.toString());

      const url = `${this.baseURL}/api/datasets?${searchParams.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Datasets request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Datasets request failed:', error);
      throw error;
    }
  }

  /**
   * Create a visualization
   */
  async createVisualization(visualization: {
    dataset_id: string;
    chart_type: string;
    chart_config: Record<string, any>;
    title?: string;
    description?: string;
  }): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/visualizations/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visualization),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Visualization creation failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Visualization creation failed:', error);
      throw error;
    }
  }

  /**
   * Share a visualization
   */
  async shareVisualization(visualizationId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/visualizations/${visualizationId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Visualization sharing failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Visualization sharing failed:', error);
      throw error;
    }
  }

  /**
   * Get shared visualization
   */
  async getSharedVisualization(shareToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/visualizations/shared/${shareToken}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Shared visualization request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Shared visualization request failed:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/health/`);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Detailed health check with system metrics
   */
  async detailedHealthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/health/detailed`);

      if (!response.ok) {
        throw new Error(`Detailed health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Detailed health check failed:', error);
      throw error;
    }
  }

  /**
   * Check if backend is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }
}

// Default instance
export const backendAPI = new BackendAPIClient();