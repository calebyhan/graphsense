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

// Comprehensive dataset object with all possible chart attributes
export interface DatasetAttributes {
  // Core data
  data: any[];
  columns: ColumnProfile[];
  
  // Basic mappings (for simple charts)
  xAxis?: string;
  yAxis?: string;
  category?: string;
  value?: string;
  
  // Advanced mappings (for complex charts)
  color?: string;
  size?: string;
  opacity?: string;
  shape?: string;
  
  // Flow/Network chart attributes
  source?: string;
  target?: string;
  weight?: string;
  
  // Hierarchical data attributes
  hierarchyField?: string;
  parentField?: string;
  childrenField?: string;
  
  // Statistical chart attributes
  bins?: number;
  bandwidth?: number;
  
  // Multi-dimensional attributes
  facetRow?: string;
  facetCol?: string;
  groupBy?: string;
  
  // Time series attributes
  timeField?: string;
  timeFormat?: string;
  timeAggregation?: 'hour' | 'day' | 'week' | 'month' | 'year';
  
  // Geographical attributes
  latitude?: string;
  longitude?: string;
  geoField?: string;
  
  // Matrix/Heatmap attributes
  rowField?: string;
  colField?: string;
  valueField?: string;
  
  // Custom attributes for specialized charts
  customAttributes?: Record<string, any>;
}

// Enhanced ChartConfig that extracts relevant attributes from DatasetAttributes
export interface ChartConfig {
  title: string;
  data: any[];
  
  // Core mappings
  xAxis?: string;
  yAxis?: string;
  category?: string;
  value?: string;
  
  // Visual mappings
  color?: string;
  size?: string;
  opacity?: string;
  shape?: string;
  
  // Flow/Network
  source?: string;
  target?: string;
  weight?: string;
  
  // Hierarchical
  hierarchyField?: string;
  parentField?: string;
  
  // Statistical
  bins?: number;
  bandwidth?: number;
  
  // Multi-dimensional
  facetRow?: string;
  facetCol?: string;
  groupBy?: string;
  
  // Time series
  timeField?: string;
  timeFormat?: string;
  timeAggregation?: 'hour' | 'day' | 'week' | 'month' | 'year';
  
  // Geographical
  latitude?: string;
  longitude?: string;
  geoField?: string;
  
  // Matrix/Heatmap
  rowField?: string;
  colField?: string;
  valueField?: string;
  
  // Chart-specific configurations
  chartSpecificConfig?: Record<string, any>;
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
  startAnalysis: (data: Array<Record<string, any>>, filename?: string, datasetId?: string) => Promise<void>;
  pollAnalysisStatus: (datasetId: string) => Promise<void>;
  loadAnalysisResults: (datasetId: string) => Promise<void>;
  resetAnalysis: () => void;
}