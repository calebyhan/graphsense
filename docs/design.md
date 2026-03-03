# Design Document

## Overview

The GraphSense is a full-stack web application that leverages an intelligent agentic pipeline to automatically analyze datasets and recommend optimal visualizations. The system combines Next.js 15/React frontend with a Python backend featuring multiple specialized AI agents powered by Google Gemini that collaborate to provide high-quality chart recommendations with transparent reasoning.

The core innovation lies in the multi-agent architecture where specialized Gemini-powered agents handle different aspects of data analysis, chart selection, and validation, creating a robust feedback loop that ensures recommendation quality and provides clear justifications for visualization choices. The entire system is containerized with Docker for seamless cross-platform development and deployment, designed for hackathon-style rapid development with local execution and Supabase for data persistence.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend (Next.js/React/TypeScript)"
        UI[User Interface]
        PARSER[Client-Side File Parser]
        VIZ[Visualization Engine]
        STATE[State Management]
    end

    subgraph "Backend (Python/FastAPI)"
        API[API Gateway]
        PROCESSOR[Data Processing Service]
        PIPELINE[Agentic Pipeline Orchestrator]
    end

    subgraph "Agentic Pipeline"
        PROFILER[Enhanced Data Profiler Agent]
        RECOMMENDER[Chart Recommender Agent]
        VALIDATOR[Validation Agent]
        BATCH[Batched API Manager]
    end

    subgraph "Data Layer"
        SUPABASE[(Supabase)]
        CACHE[Redis Cache]
    end

    UI --> PARSER
    PARSER --> API
    VIZ --> API
    API --> PROCESSOR
    API --> PIPELINE
    PIPELINE --> PROFILER
    PIPELINE --> RECOMMENDER
    PIPELINE --> VALIDATOR
    PIPELINE --> BATCH
    API --> SUPABASE
    API --> CACHE
```

### Technology Stack

**Frontend:**

- Next.js 15 with App Router for server-side rendering and routing
- React 18 with TypeScript for type-safe component development
- Tailwind CSS for responsive styling
- D3.js and Chart.js for interactive visualizations
- Zustand for lightweight state management
- React Query for server state management and caching

**Backend:**

- Python 3.11+ with FastAPI for high-performance API development
- Pydantic for data validation and serialization
- Pandas and NumPy for data processing and analysis
- LangChain for LLM agent orchestration and management
- Google Gemini API for agent reasoning and LLM capabilities

**Infrastructure:**

- Supabase for database, authentication, file storage, and caching
- Docker for containerization and cross-platform compatibility
- Local development environment (laptop-based for hackathon)
- Simplified architecture optimized for rapid development

## Components and Interfaces

### Frontend Components

#### Core UI Components

```typescript
interface DatasetSelectorProps {
  onFileSelect: (processedData: ProcessedDataset) => Promise<void>;
  supportedFormats: string[];
  maxFileSize: number;
}

interface VisualizationRecommendation {
  id: string;
  chartType: ChartType;
  confidence: number;
  reasoning: AgentReasoning[];
  dataMapping: DataMapping;
  interactionOptions: InteractionConfig;
}

interface AgentReasoning {
  agentType: "profiler" | "recommender" | "validator";
  reasoning: string;
  confidence: number;
  evidence: string[];
}
```

#### Visualization Engine

```typescript
interface ChartRenderer {
  renderChart(
    data: ProcessedDataset,
    config: ChartConfiguration,
    container: HTMLElement
  ): Promise<ChartInstance>;

  updateChart(
    instance: ChartInstance,
    newConfig: Partial<ChartConfiguration>
  ): void;

  exportChart(
    instance: ChartInstance,
    format: "png" | "svg" | "pdf"
  ): Promise<Blob>;
}
```

### Backend Services

#### Agentic Pipeline Orchestrator

```python
class AgenticPipelineOrchestrator:
    def __init__(self):
        self.agents = {
            'profiler': EnhancedDataProfilerAgent(),
            'recommender': ChartRecommenderAgent(),
            'validator': ValidationAgent()
        }
        self.batch_manager = BatchedAPIManager()

    async def process_dataset(
        self,
        dataset: ProcessedDataset
    ) -> List[VisualizationRecommendation]:
        # Orchestrate 3-agent pipeline with batched API calls
        pass
```

#### Optimized Agent Architecture

```python
class EnhancedDataProfilerAgent(BaseAgent):
    """Comprehensive data analysis including profiling, patterns, and relationships"""
    
    async def analyze(self, dataset: ProcessedDataset) -> ComprehensiveDataAnalysis:
        # Combined: statistical analysis, data type detection, quality assessment,
        # correlation analysis, trend detection, pattern recognition
        pass

class ChartRecommenderAgent(BaseAgent):
    """Recommends from ALL 10 chart types with data-driven reasoning"""
    
    async def recommend(
        self,
        analysis: ComprehensiveDataAnalysis
    ) -> List[ChartRecommendation]:
        # Evaluates ALL chart types: Bar, Line, Scatter, Pie, Histogram, 
        # Box Plot, Heatmap, Area, Treemap, Sankey
        # Returns top 3-5 with confidence scores and data mapping
        pass

class ValidationAgent(BaseAgent):
    """Validates and refines recommendations with quality scoring"""
    
    async def validate(
        self,
        recommendations: List[ChartRecommendation],
        analysis: ComprehensiveDataAnalysis
    ) -> List[ValidatedRecommendation]:
        # Quality scoring, appropriateness validation, recommendation refinement
        pass

class BatchedAPIManager:
    """Optimizes Gemini API calls through intelligent batching"""
    
    async def batch_agent_calls(
        self,
        agents: List[BaseAgent],
        dataset: ProcessedDataset
    ) -> Dict[str, Any]:
        # Batches multiple agent prompts into fewer API calls
        # Reduces latency and API costs
        pass
```

### Data Processing Pipeline

#### Data Processing Service

```python
class DataProcessingService:
    """Processes client-parsed data for agent analysis"""
    
    async def process_dataset(self, client_data: Dict) -> ProcessedDataset:
        # Validate and standardize client-parsed data
        # Perform additional data quality checks
        # Prepare data for agent analysis
        pass

    def enhance_data_profile(self, dataset: ProcessedDataset) -> ProcessedDataset:
        # Add server-side data insights
        # Perform advanced statistical analysis
        pass

    def validate_client_data(self, data: Dict) -> bool:
        # Validate data structure and content from client
        pass
```

## Data Models

### Core Data Models

```python
from pydantic import BaseModel
from typing import List, Dict, Optional, Union
from enum import Enum

class DataType(str, Enum):
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"
    TEMPORAL = "temporal"
    TEXT = "text"
    BOOLEAN = "boolean"

class ChartType(str, Enum):
    BAR = "bar"
    LINE = "line"
    SCATTER = "scatter"
    PIE = "pie"
    HISTOGRAM = "histogram"
    BOX_PLOT = "box_plot"
    HEATMAP = "heatmap"
    AREA = "area"
    TREEMAP = "treemap"
    SANKEY = "sankey"

class ProcessedDataset(BaseModel):
    id: str
    filename: str
    columns: Dict[str, DataType]
    row_count: int
    data_quality_score: float
    sample_data: List[Dict[str, Union[str, int, float]]]
    metadata: Dict[str, any]

class DataProfile(BaseModel):
    dataset_id: str
    column_profiles: Dict[str, ColumnProfile]
    correlations: Dict[str, float]
    data_quality_issues: List[DataQualityIssue]
    statistical_summary: Dict[str, any]

class ColumnProfile(BaseModel):
    name: str
    data_type: DataType
    null_percentage: float
    unique_values: int
    distribution_summary: Dict[str, any]
    sample_values: List[any]

class ChartRecommendation(BaseModel):
    chart_type: ChartType
    confidence: float
    data_mapping: DataMapping
    reasoning: List[AgentReasoning]
    interaction_config: InteractionConfig
    styling_suggestions: Dict[str, any]

class DataMapping(BaseModel):
    x_axis: Optional[str]
    y_axis: Optional[str]
    color: Optional[str]
    size: Optional[str]
    facet: Optional[str]
    additional_dimensions: Dict[str, str]
```

### Database Schema (Supabase)

```sql
-- Users and authentication handled by Supabase Auth

-- Datasets table
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    filename VARCHAR NOT NULL,
    file_size INTEGER NOT NULL,
    processing_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status VARCHAR DEFAULT 'pending',
    data_profile JSONB,
    sample_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visualizations table
CREATE TABLE visualizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id),
    user_id UUID REFERENCES auth.users(id),
    chart_type VARCHAR NOT NULL,
    configuration JSONB NOT NULL,
    agent_reasoning JSONB NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    share_token VARCHAR UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent analysis results
CREATE TABLE agent_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id),
    agent_type VARCHAR NOT NULL,
    analysis_result JSONB NOT NULL,
    confidence_score FLOAT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Error Handling

### Frontend Error Handling

- Global error boundary for React components
- Toast notifications for user-facing errors
- Retry mechanisms for failed API calls
- Graceful degradation for visualization rendering failures

### Backend Error Handling

```python
class AgentError(Exception):
    """Base exception for agent-related errors"""
    pass

class DataProcessingError(AgentError):
    """Raised when data processing fails"""
    pass

class RecommendationError(AgentError):
    """Raised when chart recommendation fails"""
    pass

# Error handling middleware
@app.exception_handler(AgentError)
async def agent_error_handler(request: Request, exc: AgentError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "Agent Processing Error",
            "message": str(exc),
            "suggestions": get_error_suggestions(exc)
        }
    )
```

### Agentic Pipeline Error Recovery

- Fallback mechanisms when individual agents fail
- Partial results delivery when some agents succeed
- Automatic retry with exponential backoff
- Human escalation for persistent failures

### Docker Configuration

The application will be fully containerized for cross-platform compatibility and easy setup:

```yaml
# docker-compose.yml
version: "3.8"
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    volumes:
      - ./backend:/app
      - ./uploads:/app/uploads
```

### Gemini API Integration

```python
# Gemini agent configuration
class GeminiAgentConfig:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model = "gemini-2.0-flash-exp"  # Latest Gemini model
        self.temperature = 0.1  # Low temperature for consistent reasoning
        self.max_tokens = 4096

class BaseAgent:
    def __init__(self, config: GeminiAgentConfig):
        self.config = config
        self.client = genai.GenerativeModel(config.model)

    async def generate_response(self, prompt: str, context: Dict) -> str:
        response = await self.client.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=self.config.temperature,
                max_output_tokens=self.config.max_tokens
            )
        )
        return response.text
```

This design provides a robust foundation for building the GraphSense with a focus on the agentic pipeline architecture, scalable data processing, user-friendly visualization capabilities, and hackathon-ready Docker containerization using Google Gemini for intelligent reasoning.