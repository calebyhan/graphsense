# Contributing to GraphSense

## Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- [Doppler CLI](https://docs.doppler.com/docs/install-cli) (replaces manual `.env` management)

## Secret Management (Doppler)

Secrets are managed via [Doppler](https://doppler.com). No `.env` file needed — Doppler injects secrets at runtime.

**One-time setup (per machine):**

```bash
# Install Doppler CLI
brew install dopplerhq/cli/doppler   # macOS
# or: https://docs.doppler.com/docs/install-cli
# may need to install dependency:
# brew install gnupg

# Authenticate
doppler login

# Link this repo to the project
doppler setup   # select project: graphsense, config: dev
```

## Setup

### Option A: Docker (Recommended)

```bash
git clone https://github.com/calebyhan/vthacks25.git
cd vthacks25
doppler run -- docker-compose up --build

# Or run backend only (if running frontend locally)
doppler run -- docker-compose up backend -d
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
doppler run -- uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
doppler run -- npm run dev
```

## Environment Variables Reference

See `.env.example` for the full list of required variables. Key secrets:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI analysis |
| `SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key — safe for frontend (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Supabase secret key — backend only (`sb_secret_...`) |

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
