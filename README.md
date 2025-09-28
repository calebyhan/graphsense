# Auto Visualization Agent 🤖📊
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)]() [![AI](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-blue)]() [![Docker](https://img.shields.io/badge/Docker-Ready-blue)]() [![Integration](https://img.shields.io/badge/Tests-Passing-brightgreen)]()


## Technical Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts, Zustand, Motion (Framer)
- **Canvas Engine**: Custom infinite canvas with coordinate transformations, viewport management, minimap integration
- **Performance**: React.memo, useMemo, data sampling, RAF-throttled updates, optimized rendering
- **Backend**: Python 3.11, FastAPI, Google Gemini API, Pandas, Scikit-learn
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Infrastructure**: Docker, Docker Compose
- **AI**: Google Gemini 2.0 Flash for intelligent analysis
An AI-powered data visualization platform that automatically analyzes datasets and recommends optimal chart types using a sophisticated 3-agent pipeline powered by Google Gemini 2.0 Flash. Features an advanced infinite canvas with precise positioning, minimap navigation, and viewport-aware chart placement. **Production ready with enhanced UX!**

## Features

### Core Capabilities
- **Smart File Processing**: Client-side parsing of CSV, JSON, Excel, and TSV files (up to 100MB)
- **3-Agent AI Pipeline**: Enhanced Data Profiler → Chart Recommender → Validation Agent
- **10 Chart Types**: Support for all major visualization types (Bar, Line, Scatter, Pie, Histogram, Box Plot, Heatmap, Area, Treemap, Sankey)
- **Advanced Infinite Canvas**: Viewport-aware chart placement, precise coordinate system, smooth zoom (0.1x-5x)
- **Smart Minimap Navigation**: Accurate chart positioning, click-to-navigate, real-time viewport tracking
- **Intelligent Chart Placement**: Auto-detection of axis fields, anti-stacking with random offsets, viewport-centered positioning
- **Performance Optimized**: Data sampling for large datasets, memoized rendering, smooth interactions
- **Real-time Progress**: Live agent status updates and progress tracking
- **Backend Status Checker**: Live connection monitoring with system metrics and health diagnostics
- **Export Functionality**: PNG, SVG, and PDF export for all chart types
- **Sharing System**: Generate shareable links with tokens

### AI-Powered Analysis
- **Enhanced Data Profiler Agent**: Comprehensive statistical analysis, correlation detection, pattern recognition
- **Chart Recommender Agent**: Evaluates ALL 10 chart types with confidence scoring and data mapping
- **Validation Agent**: Quality assessment, appropriateness validation, and recommendation refinement
- **Transparent Reasoning**: Detailed explanations for why specific charts were recommended
- **JSON Parsing**: Robust AI response parsing with fallback mechanisms
- **Real-time Processing**: Complete pipeline processes datasets in ~20-40 seconds

### Canvas & UX Features
- **Precision Positioning**: Fixed coordinate system ensures charts appear exactly where expected
- **Minimap Accuracy**: 1:1 correspondence between minimap dots and actual chart positions
- **Viewport-Aware Creation**: New charts automatically placed in your current view
- **Smooth Navigation**: Pan, zoom, and navigate with mouse, keyboard shortcuts, or minimap clicks
- **Anti-Stacking Intelligence**: Random offsets prevent charts from overlapping when created
- **Performance Indicators**: Visual feedback for large dataset processing with data sampling
- **Debug Tools**: Development mode includes positioning diagnostics and coordinate verification

### System Monitoring & Diagnostics
- **Real-time Status Indicator**: Always-visible connection status on the canvas
- **Detailed Health Metrics**: Backend response times, system CPU/memory usage, database connectivity
- **Automatic Health Checks**: Continuous monitoring every 30 seconds with instant error reporting
- **Network Status Detection**: Automatic offline/online detection with graceful degradation
- **Interactive Diagnostics**: Click-to-expand detailed system information
- **Keyboard Shortcuts**: Quick access via Ctrl+Shift+H for power users
- **Error Recovery**: Automatic reconnection attempts and status restoration


## Installation & Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Google Gemini API Key
- Supabase Project

### 1. Clone and Setup Environment

```bash
git clone <repository-url>
cd vthacks25

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your credentials:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Application URLs
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Setup Database

```bash
# Run the database schema in your Supabase SQL editor
cat backend/database/schema.sql
```

### 4. Choose Your Setup Method

#### Option A: Docker (Recommended)
```bash
# Build and start all services
docker-compose up --build

# Or run backend only (if running frontend locally)
docker-compose up backend -d

# Services will be available at:
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
# Health Check: http://localhost:8000/health/
```

#### Option B: Local Development
```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

### 5. Verify Installation

```bash
# Run integration tests
node test/test-integration.js
```

## Quick Start

1. **Open the Application**: Navigate to http://localhost:3000

2. **Upload Your Dataset**:
   - Drag and drop a CSV, JSON, Excel, or TSV file
   - Or use the sample datasets provided

3. **Watch the AI Analysis**:
   - Enhanced Data Profiler analyzes your data structure and patterns
   - Chart Recommender evaluates all 10 chart types
   - Validation Agent scores and refines recommendations

4. **Explore Visualizations**:
   - View top 3-5 recommended charts with confidence scores
   - Read detailed AI reasoning for each recommendation
   - Drag charts onto the infinite canvas

5. **Navigate the Canvas**:
   - Use mouse wheel or trackpad to zoom in/out (0.1x to 5x)
   - Drag with mouse to pan around the infinite canvas
   - Click minimap to instantly jump to any area
   - Press '0' to fit all charts in view, '=' to zoom in, '-' to zoom out

6. **Organize Your Visualizations**:
   - Charts automatically appear in your current viewport
   - Drag charts to reposition them as needed
   - Use the minimap to see the big picture and navigate quickly
   - Charts are intelligently spaced to prevent overlapping

7. **Export and Share**:
   - Export charts as PNG, SVG, or PDF
   - Generate shareable links for collaboration

## Project Structure

```
vthacks25/
├── frontend/                # Next.js Frontend
│   ├── app/                 # App Router pages and API routes
│   ├── components/          # React components
│   │   ├── canvas/          # Infinite canvas, minimap, elements
│   │   ├── charts/          # Chart components and rendering
│   │   ├── debug/           # Development and positioning tools
│   │   ├── panels/          # Side panels and navigation
│   │   └── visualization/   # Chart cards and interactions
│   ├── lib/                 # Utilities and services
│   ├── store/               # Zustand state management (canvas, analysis)
│   └── public/              # Static assets
├── backend/                 # Python FastAPI Backend
│   ├── app/                 # Application code
│   │   ├── agents/          # AI agent implementations
│   │   ├── api/             # API routes
│   │   ├── core/            # Configuration and logging
│   │   ├── database/        # Supabase client
│   │   ├── models/          # Pydantic data models
│   │   └── services/        # Business logic
│   ├── database/            # SQL schema
│   └── requirements.txt     # Python dependencies
├── docs/                    # Project documentation
├── test/                    # Integration tests
│   └── test-integration.js  # Main integration test
├── docker-compose.yml       # Docker configuration
└── .env.example             # Environment template
``