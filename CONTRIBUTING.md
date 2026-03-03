# Contributing to GraphSense

## Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Google Gemini API Key
- Supabase Project

## Setup

### Option A: Docker (Recommended)

```bash
git clone https://github.com/calebyhan/vthacks25.git
cd vthacks25
cp .env.example .env
# Fill in required values in .env
docker-compose up --build

# Or run backend only (if running frontend locally)
docker-compose up backend -d
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health/

### Option B: Local Development

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

## Environment Configuration

Copy `.env.example` to `.env` and fill in the following:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI analysis |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (frontend) |
| `SUPABASE_SERVICE_KEY` | Supabase service key (backend) |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase project settings |

## Verify Installation

```bash
# Run integration tests
node test/test-integration.js
```

## Running Backend Tests

```bash
cd backend
pytest
```
