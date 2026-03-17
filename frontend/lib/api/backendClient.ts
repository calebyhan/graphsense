/**
 * Backend API Client
 * Handles communication with the Python FastAPI backend
 */

import { supabase } from '@/lib/supabase/client';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Returns auth headers if a Supabase session exists, empty otherwise. */
async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

export interface AnalysisRequest {
  data: Array<Record<string, any>>;
  filename?: string;
  file_type?: string;
  dataset_id?: string;  // If provided, use existing dataset instead of creating new one
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
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        let errorMessage = `API request failed: ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          // If can't parse JSON, use status-based message
          if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again later.';
          }
        }
        
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
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
      const response = await fetch(`${this.baseURL}/api/analysis/status/${datasetId}`, {
        headers: await authHeaders(),
      });

      if (!response.ok) {
        let errorMessage = `Status request failed: ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          // If can't parse JSON, use status-based message
          if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again later.';
          }
        }
        
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
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
      const response = await fetch(`${this.baseURL}/api/analysis/results/${datasetId}`, {
        headers: await authHeaders(),
      });

      if (!response.ok) {
        let errorMessage = `Results request failed: ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          // If can't parse JSON, use status-based message
          if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again later.';
          }
        }
        
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
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
      const response = await fetch(url, { headers: await authHeaders() });

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
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
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
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
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

// ---------------------------------------------------------------------------
// Canvas API
// ---------------------------------------------------------------------------

export interface CanvasThumbnail {
  elements: Array<{ type: string; x: number; y: number; w: number; h: number }>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface Canvas {
  id: string;
  name: string;
  description: string | null;
  owner_id?: string;
  permission?: string;
  share_token?: string | null;
  share_permission: 'view' | 'edit' | null;
  has_share_link: boolean;
  dataset_count: number;
  thumbnail?: CanvasThumbnail | null;
  created_at: string;
  updated_at: string;
  datasets?: Array<{
    id: string;
    filename: string;
    processing_status: string;
    metadata: Record<string, any> | null;
    created_at: string;
  }>;
}

export interface SharedCanvas {
  id: string;
  name: string;
  description: string | null;
  owner: { id: string; email: string | null };
  permission: string;
  dataset_count: number;
  thumbnail?: CanvasThumbnail | null;
  joined_at: string;
  updated_at: string;
}

export interface Collaborator {
  user_id: string;
  email: string | null;
  permission: 'view' | 'edit';
  joined_at: string;
}

export interface ShareLinkResponse {
  share_token: string;
  share_permission: 'view' | 'edit';
  share_url: string;
}

export interface JoinCanvasResponse {
  canvas_id: string;
  permission: 'view' | 'edit';
}

async function makeRequest(path: string, options: RequestInit, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: { ...headers, ...((options.headers as Record<string, string>) || {}) },
  });
}

// accessToken is passed explicitly from hooks (avoids a race where getSession()
// returns null briefly after onAuthStateChange has fired but before the SDK's
// internal state has been fully propagated to the next getSession() caller).
// On 401, refreshes the session and retries once to handle expired access tokens.
async function canvasRequest<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  let token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
  let response = await makeRequest(path, options, token);

  if (response.status === 401) {
    // Access token may be expired — attempt a silent refresh and retry once.
    const { data: { session } } = await supabase.auth.refreshSession();
    if (session?.access_token) {
      token = session.access_token;
      response = await makeRequest(path, options, token);
    }
  }

  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || err.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

export const canvasAPI = {
  list: (token?: string) => canvasRequest<Canvas[]>('/api/canvases', {}, token),
  listShared: (token?: string) => canvasRequest<SharedCanvas[]>('/api/canvases/shared', {}, token),
  get: (id: string, token?: string) => canvasRequest<Canvas>(`/api/canvases/${id}`, {}, token),
  create: (name: string, description?: string, token?: string) =>
    canvasRequest<Canvas>('/api/canvases', { method: 'POST', body: JSON.stringify({ name, description }) }, token),
  // PATCH returns the raw canvases row — derived fields (dataset_count, has_share_link) are not included.
  // Callers should merge the result with local state rather than replacing the full Canvas object.
  update: (id: string, data: { name?: string; description?: string; thumbnail?: CanvasThumbnail | null }, token?: string) =>
    canvasRequest<Partial<Canvas>>(`/api/canvases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token),
  delete: (id: string, token?: string) => canvasRequest<void>(`/api/canvases/${id}`, { method: 'DELETE' }, token),
  generateShareLink: (id: string, permission: 'view' | 'edit', token?: string) =>
    canvasRequest<ShareLinkResponse>(`/api/canvases/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ permission }),
    }, token),
  revokeShareLink: (id: string, token?: string) =>
    canvasRequest<void>(`/api/canvases/${id}/share`, { method: 'DELETE' }, token),
  join: (shareToken: string, accessToken?: string) =>
    canvasRequest<JoinCanvasResponse>('/api/canvases/join', { method: 'POST', body: JSON.stringify({ token: shareToken }) }, accessToken),
  listCollaborators: (id: string, token?: string) =>
    canvasRequest<Collaborator[]>(`/api/canvases/${id}/collaborators`, {}, token),
  removeCollaborator: (canvasId: string, userId: string, token?: string) =>
    canvasRequest<void>(`/api/canvases/${canvasId}/collaborators/${userId}`, { method: 'DELETE' }, token),
};