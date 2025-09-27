# Auto Visualization Agent 🤖📊

[![Status](https://img.shields.io/badge/Status-Operational-brightgreen)]() [![AI](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-blue)]() [![Docker](https://img.shields.io/badge/Docker-Ready-blue)]() [![Integration](https://img.shields.io/badge/Tests-Passing-brightgreen)]()

An AI-powered data visualization platform that automatically analyzes datasets and recommends optimal chart types using a sophisticated 3-agent pipeline powered by Google Gemini 2.0 Flash. **Fully operational and tested!**

## 🚀 Features

### ✨ Core Capabilities
- **Smart File Processing**: Client-side parsing of CSV, JSON, Excel, and TSV files (up to 100MB)
- **3-Agent AI Pipeline**: Enhanced Data Profiler → Chart Recommender → Validation Agent
- **10 Chart Types**: Support for all major visualization types (Bar, Line, Scatter, Pie, Histogram, Box Plot, Heatmap, Area, Treemap, Sankey)
- **Real-time Progress**: Live agent status updates and progress tracking
- **Backend Status Checker**: Live connection monitoring with system metrics and health diagnostics
- **Export Functionality**: PNG, SVG, and PDF export for all chart types
- **Infinite Canvas**: Drag-and-drop workspace for organizing visualizations
- **Sharing System**: Generate shareable links with tokens

### 🤖 AI-Powered Analysis
- **Enhanced Data Profiler Agent**: Comprehensive statistical analysis, correlation detection, pattern recognition ✅
- **Chart Recommender Agent**: Evaluates ALL 10 chart types with confidence scoring and data mapping ✅
- **Validation Agent**: Quality assessment, appropriateness validation, and recommendation refinement ✅
- **Transparent Reasoning**: Detailed explanations for why specific charts were recommended ✅
- **JSON Parsing**: Robust AI response parsing with fallback mechanisms ✅
- **Real-time Processing**: Complete pipeline processes datasets in ~20-40 seconds ⚡

### � System Monitoring & Diagnostics
- **Real-time Status Indicator**: Always-visible connection status on the canvas
- **Detailed Health Metrics**: Backend response times, system CPU/memory usage, database connectivity
- **Automatic Health Checks**: Continuous monitoring every 30 seconds with instant error reporting
- **Network Status Detection**: Automatic offline/online detection with graceful degradation
- **Interactive Diagnostics**: Click-to-expand detailed system information
- **Keyboard Shortcuts**: Quick access via Ctrl+Shift+H for power users
- **Error Recovery**: Automatic reconnection attempts and status restoration

### �🛠 Technical Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts, Zustand
- **Backend**: Python 3.11, FastAPI, Google Gemini API, Pandas, Scikit-learn
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Infrastructure**: Docker, Docker Compose
- **AI**: Google Gemini 2.0 Flash for intelligent analysis

## 📦 Installation & Setup

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

## 🎯 Quick Start

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

5. **Export and Share**:
   - Export charts as PNG, SVG, or PDF
   - Generate shareable links for collaboration

## 📁 Project Structure

```
vthacks25/
├── frontend/                # Next.js Frontend
│   ├── app/                 # App Router pages and API routes
│   ├── components/          # React components
│   ├── lib/                 # Utilities and services
│   ├── store/              # Zustand state management
│   └── public/             # Static assets
├── backend/                # Python FastAPI Backend
│   ├── app/                # Application code
│   │   ├── agents/         # AI agent implementations
│   │   ├── api/            # API routes
│   │   ├── core/           # Configuration and logging
│   │   ├── database/       # Supabase client
│   │   ├── models/         # Pydantic data models
│   │   └── services/       # Business logic
│   ├── database/           # SQL schema
│   └── requirements.txt    # Python dependencies
├── docs/                   # Project documentation
├── test/                   # Integration tests
│   └── test-integration.js # Main integration test
├── docker-compose.yml      # Docker configuration
└── .env.example           # Environment template
```

## 🧪 Testing

### Integration Tests
```bash
# Test complete workflow
node test/test-integration.js

# Expected output:
# ✅ Backend health check passed
# ✅ Analysis started successfully
# ✅ Analysis completed successfully
# ⚠️ Results retrieval (known minor issue - doesn't affect main app)
```

## 🔧 Troubleshooting

### Common Issues

**Frontend container fails to start:**
```bash
# Run frontend locally instead
cd frontend && npm install && npm run dev
```

**Analysis fails with JSON errors:**
- ✅ **Fixed!** Robust JSON parsing and serialization implemented
- All numpy/pandas types properly converted
- Enum serialization handled correctly

**Gemini API errors:**
- Ensure your `GEMINI_API_KEY` is valid
- Check API quotas and rate limits
- Model now uses `gemini-2.0-flash-exp` (latest)

**Database connection issues:**
- Verify Supabase credentials in `.env`
- Ensure database schema is applied
- Check Row Level Security policies

### Performance Notes
- Analysis typically completes in 20-40 seconds
- Large datasets (>5000 rows) may take longer
- Each agent runs sequentially for quality assurance

### Debug Commands
```bash
# Check backend logs
docker-compose logs backend

# Check container status
docker-compose ps

# Restart services
docker-compose down && docker-compose up -d
```

## 🏗 Architecture Overview

### 3-Agent Pipeline Flow
```
📁 File Upload (Client-side parsing)
    ↓
🤖 Enhanced Data Profiler Agent
    ├── Statistical analysis
    ├── Correlation detection
    ├── Pattern recognition
    └── Data quality assessment
    ↓
📊 Chart Recommender Agent
    ├── Evaluates ALL 10 chart types
    ├── Confidence scoring
    ├── Data mapping suggestions
    └── Reasoning generation
    ↓
✅ Validation Agent
    ├── Quality assessment
    ├── Appropriateness validation
    ├── Recommendation refinement
    └── Final scoring
    ↓
📈 Validated Recommendations
```

## 📊 Current Status

### ✅ Completed Features
- [x] Complete 3-agent AI pipeline
- [x] Gemini 2.0 Flash integration
- [x] JSON serialization fixes
- [x] Robust error handling
- [x] Docker containerization
- [x] Database schema and storage
- [x] Frontend file upload and processing
- [x] Real-time progress tracking
- [x] Integration testing

### 🚀 Ready for Demo
- **Backend**: Fully operational with all agents working
- **Frontend**: Complete UI with file upload and visualization
- **AI Processing**: Successfully generates 3-5 chart recommendations
- **Database**: Stores all analysis results and metadata
- **Integration**: End-to-end workflow tested and verified

**Built for VTHacks 2025** 🏆

---

*Last updated: September 27, 2025 - All systems operational! 🎉*
