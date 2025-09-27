export interface DataProfile {
  columns: ColumnProfile[];
  rowCount: number;
  dataQuality: 'high' | 'medium' | 'low';
}

export interface ColumnProfile {
  name: string;
  type: 'numeric' | 'categorical' | 'temporal' | 'text';
  stats?: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  uniqueValues?: number;
  nullCount: number;
}

export interface Pattern {
  type: 'correlation' | 'trend' | 'seasonality' | 'distribution';
  description: string;
  strength: number;
  columns: string[];
}

export interface ChartRecommendation {
  chartType: 'line' | 'bar' | 'scatter' | 'pie' | 'histogram' | 'box_plot' | 'heatmap' | 'area' | 'treemap' | 'sankey';
  confidence: number;
  justification: string;
  config: ChartConfig;
}

export interface ChartConfig {
  xAxis?: string;
  yAxis?: string;
  category?: string;
  value?: string;
  color?: string;
  size?: string;
  source?: string;
  target?: string;
  title: string;
  data: any[];
  bins?: number; // For histogram
  hierarchyField?: string; // For treemap
}

export interface AnalysisResult {
  profile: DataProfile;
  patterns: Pattern[];
  recommendations: ChartRecommendation[];
}

export interface AgentState {
  profiler: 'idle' | 'running' | 'complete';
  recommender: 'idle' | 'running' | 'complete';
  validator: 'idle' | 'running' | 'complete';
}

export interface AnalysisStore {
  rawData: any[] | null;
  parsedData: any[] | null;
  agentStates: AgentState;
  dataProfile: DataProfile | null;
  patterns: Pattern[] | null;
  recommendations: ChartRecommendation[] | null;
  selectedChart: ChartConfig | null;
  currentDatasetId: string | null;
  isLoading: boolean;
  error: string | null;
  setRawData: (data: any[] | null) => void;
  updateAgentState: (agent: keyof AgentState, state: AgentState[keyof AgentState]) => void;
  setRecommendations: (recommendations: ChartRecommendation[]) => void;
  selectChart: (config: ChartConfig) => void;
  setDataProfile: (profile: DataProfile) => void;
  setPatterns: (patterns: Pattern[]) => void;
  setCurrentDatasetId: (id: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  startAnalysis: (data: Array<Record<string, any>>, filename?: string) => Promise<void>;
  pollAnalysisStatus: (datasetId: string) => Promise<void>;
  loadAnalysisResults: (datasetId: string) => Promise<void>;
  resetAnalysis: () => void;
}