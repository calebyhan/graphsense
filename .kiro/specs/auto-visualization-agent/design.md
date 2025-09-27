# Design Document

## Overview

The Auto Visualization Agent is a full-stack web application that leverages an intelligent agentic pipeline to automatically analyze datasets and recommend optimal visualizations. The system combines Next.js 15/React frontend with a Python backend featuring multiple specialized AI agents powered by Google Gemini that collaborate to provide high-quality chart recommendations with transparent reasoning.

The core innovation lies in the multi-agent architecture where specialized Gemini-powered agents handle different aspects of data analysis, chart selection, and validation, creating a robust feedback loop that ensures recommendation quality and provides clear justifications for visualization choices. The entire system is containerized with Docker for seamless cross-platform development and deployment, designed for hackathon-style rapid development with local execution and Supabase for data persistence.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend (Next.js/React/TypeScript)"
        UI[User Interface]
        VIZ[Visualization Engine]
        STATE[State Management]
    end

    subgraph "Backend (Python/FastAPI)"
        API[API Gateway]
        UPLOAD[File Upload Service]
        PIPELINE[Agentic Pipeline Orchestrator]
    end

    subgraph "Agentic Pipeline"
        PROFILER[Data Profiler Agent]
        PATTERN[Pattern Recognition Agent]
        INTENT[Intent Discovery Agent]
        RECOMMENDER[Chart Recommender Agent]
        VALIDATOR[Validation Agent]
        CONSENSUS[Consensus Manager]
    end

    subgraph "Data Layer"
        SUPABASE[(Supabase)]
        CACHE[Redis Cache]
        FILES[File Storage]
    end

    UI --> API
    VIZ --> API
    API --> UPLOAD
    API --> PIPELINE
    PIPELINE --> PROFILER
    PIPELINE --> PATTERN
    PIPELINE --> INTENT
    PIPELINE --> RECOMMENDER
    PIPELINE --> VALIDATOR
    PIPELINE --> CONSENSUS
    API --> SUPABASE
    API --> CACHE
    UPLOAD --> FILES
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
interface DatasetUploadProps {
  onUpload: (file: File) => Promise<void>;
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
  agentType: "profiler" | "pattern" | "intent" | "recommender" | "validator";
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
            'profiler': DataProfilerAgent(),
            'pattern': PatternRecognitionAgent(),
            'intent': IntentDiscoveryAgent(),
            'recommender': ChartRecommenderAgent(),
            'validator': ValidationAgent()
        }
        self.consensus_manager = ConsensusManager()

    async def process_dataset(
        self,
        dataset: ProcessedDataset
    ) -> List[VisualizationRecommendation]:
        # Orchestrate multi-agent analysis
        pass
```

#### Specialized Agents

```python
class DataProfilerAgent(BaseAgent):
    """Analyzes dataset characteristics, data types, and quality"""

    async def analyze(self, dataset: ProcessedDataset) -> DataProfile:
        # Statistical analysis, data type detection, quality assessment
        pass

class PatternRecognitionAgent(BaseAgent):
    """Identifies patterns, trends, and relationships in data"""

    async def analyze(self, dataset: ProcessedDataset) -> PatternAnalysis:
        # Correlation analysis, trend detection, clustering
        pass

class IntentDiscoveryAgent(BaseAgent):
    """Infers user intent and visualization goals from data context"""

    async def analyze(
        self,
        dataset: ProcessedDataset,
        context: Optional[str]
    ) -> IntentAnalysis:
        # LLM-based intent inference from column names, data patterns
        pass

class ChartRecommenderAgent(BaseAgent):
    """Recommends specific chart types based on analysis"""

    async def recommend(
        self,
        profile: DataProfile,
        patterns: PatternAnalysis,
        intent: IntentAnalysis
    ) -> List[ChartRecommendation]:
        # Chart type selection based on best practices and data characteristics
        pass

class ValidationAgent(BaseAgent):
    """Validates and scores recommendations for quality"""

    async def validate(
        self,
        recommendations: List[ChartRecommendation],
        dataset: ProcessedDataset
    ) -> List[ValidatedRecommendation]:
        # Quality scoring, appropriateness validation
        pass
```

### Data Processing Pipeline

#### File Processing Service

```python
class FileProcessingService:
    def __init__(self):
        self.parsers = {
            'csv': CSVParser(),
            'json': JSONParser(),
            'xlsx': ExcelParser(),
            'tsv': TSVParser()
        }

    async def process_file(self, file: UploadedFile) -> ProcessedDataset:
        # File parsing, validation, and standardization
        pass

    def detect_data_types(self, df: pd.DataFrame) -> Dict[str, DataType]:
        # Intelligent data type detection
        pass

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        # Data cleaning and preprocessing
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
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status VARCHAR DEFAULT 'pending',
    data_profile JSONB,
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
        self.model = "gemini-1.5-pro"  # Latest Gemini model
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

This design provides a robust foundation for building the Auto Visualization Agent with a focus on the agentic pipeline architecture, scalable data processing, user-friendly visualization capabilities, and hackathon-ready Docker containerization using Google Gemini for intelligent reasoning.
