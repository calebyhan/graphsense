# Auto Visualization Agent

An AI-powered data visualization platform that analyzes datasets and recommends chart types using a 3-agent pipeline powered by Google Gemini 2.0 Flash.

## Features
- Upload CSV, JSON, Excel, TSV (up to 100MB)
- 3-agent pipeline: Profiler → Recommender → Validator
- Supports 10 chart types (bar, line, scatter, etc.)
- Infinite canvas for visualizations
- Export as PNG, SVG, PDF

## Tech Stack
- Frontend: Next.js, React, TypeScript, Tailwind, Recharts
- Backend: Python, FastAPI, Gemini API, Pandas
- Database: Supabase (PostgreSQL)
- Infra: Docker

## Setup
```bash
git clone <repository-url>
cd vthacks25
cp .env.example .env
docker-compose up --build


## Quick Start

1. Go to [http://localhost:3000](http://localhost:3000)  
2. Upload a dataset  
3. View recommended charts
