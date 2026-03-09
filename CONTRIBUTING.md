# Contributing to GraphSense

Thank you for contributing to GraphSense! This guide will help you get started.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Development Workflow](#development-workflow)
- [Branching Strategy](#branching-strategy)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Environment Variables](#environment-variables-reference)

## Prerequisites

- Node.js 18+
- Python 3.13+
- Docker & Docker Compose
- [Doppler CLI](https://docs.doppler.com/docs/install-cli) (replaces manual `.env` management)
- Git

## Setup

### 1. Fork & Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/calebyhan/vthacks25.git
cd vthacks25

# Add upstream remote
git remote add upstream https://github.com/calebyhan/vthacks25.git
```

### 2. Secret Management (Doppler)

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

### 3. Start Development Environment

#### Option A: Docker (Recommended)

```bash
doppler run -- docker-compose up --build

# Or run backend only (if running frontend locally)
doppler run -- docker-compose up backend -d
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health/

#### Option B: Local Development

```bash
# Terminal 1: Backend
cd backend
python3.13 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
doppler run -- uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
doppler run -- npm run dev
```

### 4. Verify Installation

```bash
# Backend unit tests
cd backend && pytest

# Integration tests (requires backend running)
cd backend
doppler run -- uvicorn main:app --port 8000 &
pytest tests/test_integration.py -v
```

## Development Workflow

### Daily Workflow

1. **Sync with upstream**
   ```bash
   git checkout main
   git pull upstream main
   git push origin main
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or: fix/bug-description, docs/documentation-update, refactor/code-improvement
   ```

3. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: add new visualization type"
   # Follow conventional commits (see below)
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Then create PR on GitHub
   ```

## Branching Strategy

We use **Git Flow** with the following branches:

### Main Branches

- **`main`** — Production-ready code. Protected branch.

### Supporting Branches

- **`feature/*`** — New features (`feature/auto-chart-selection`)
- **`fix/*`** — Bug fixes (`fix/chart-rendering-error`)
- **`docs/*`** — Documentation updates (`docs/api-reference`)
- **`refactor/*`** — Code refactoring (`refactor/analysis-pipeline`)
- **`test/*`** — Test additions/improvements (`test/integration-coverage`)

### Branch Naming Conventions

- Use lowercase with hyphens: `feature/ai-recommendations`
- Be descriptive: `fix/supabase-connection-timeout` not `fix/bug`
- Keep it concise: max 4-5 words

## Pull Request Process

### Before Creating a PR

1. **Ensure tests pass**
   ```bash
   # Backend unit tests
   cd backend && pytest

   # Integration tests (requires backend running on :8000)
   cd backend && pytest tests/test_integration.py -v
   ```

2. **Check code quality**
   ```bash
   # Frontend (if applicable)
   cd frontend && npm run lint
   
   # Run React Doctor for React changes
   npx -y react-doctor@latest . --verbose
   ```

3. **Update documentation** if you've changed:
   - API endpoints → `docs/api-documentation.md`
   - Database schema → `docs/database-schema.md`
   - Setup/deployment → `README.md` or `CONTRIBUTING.md`

### Creating the PR

1. **Push your branch** to your fork
2. **Open a PR** against `main` branch of `calebyhan/vthacks25`
3. **Fill out the PR template** (see `.github/pull_request_template.md`)
4. **Link relevant issues** using keywords: `Closes #123`, `Fixes #456`

### PR Title Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Examples:
feat(backend): add Gemini streaming for real-time analysis
fix(frontend): resolve chart rendering on Safari
docs: update API documentation with new endpoints
refactor(pipeline): simplify agent orchestration logic
test(api): add integration tests for analysis endpoints
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Tooling, dependencies, config changes
- `perf`: Performance improvement

### Review Process

Branch/ruleset policy reference: `.github/BRANCH_PROTECTION.md`

1. **Automated checks** will run (tests, linting, AI review)
2. **At least 1 approval** required from maintainers
3. **All conversations must be resolved**
4. **CI must pass** (all checks green)
5. **Squash and merge** preferred for clean history

### After Your PR is Merged

```bash
git checkout main
git pull upstream main
git push origin main
git branch -d feature/your-feature-name  # Delete local branch
git push origin --delete feature/your-feature-name  # Delete remote branch
```

## Code Standards

### Python (Backend)

- Follow **PEP 8** style guide
- Use **type hints** for function signatures
- Docstrings for all public functions (Google style)
- Max line length: 100 characters
- Use f-strings for string formatting

**Example:**
```python
def analyze_dataset(data: pd.DataFrame, timeout: int = 60) -> AnalysisResult:
    """Analyze dataset using AI pipeline.
    
    Args:
        data: Input dataframe to analyze
        timeout: Maximum execution time in seconds
        
    Returns:
        AnalysisResult containing recommendations and metadata
        
    Raises:
        TimeoutError: If analysis exceeds timeout
    """
    pass
```

### TypeScript/JavaScript (Frontend)

- Use **TypeScript** for all new code
- Follow **ESLint** configuration
- Use functional components with hooks
- Prefer `const` over `let`, avoid `var`
- Max line length: 100 characters

**Example:**
```typescript
interface ChartRendererProps {
  recommendation: ChartRecommendation;
  data: Dataset;
  onError?: (error: Error) => void;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({ 
  recommendation, 
  data,
  onError 
}) => {
  // Implementation
};
```

### Commit Messages

Follow **Conventional Commits**:

```bash
# Good
git commit -m "feat(backend): add data profiler caching"
git commit -m "fix(frontend): resolve infinite canvas zoom limits"
git commit -m "docs: update deployment instructions"

# Bad
git commit -m "fixed stuff"
git commit -m "WIP"
git commit -m "updated code"
```

## Testing

### Running Tests

```bash
# Backend unit tests
cd backend
pytest

# Backend with coverage
pytest --cov=app --cov-report=html

# Integration tests (requires live backend on :8000)
# Start backend first:
doppler run -- uvicorn main:app --port 8000 &
# Then run:
pytest tests/test_integration.py -v
# Tests automatically skip if the server isn't reachable.

# Frontend lint + type-check
cd frontend
npm run lint
npx tsc --noEmit
```

### Test Structure

| Directory | What it tests |
|---|---|
| `backend/tests/test_api_*.py` | FastAPI route unit tests (mocked Supabase/Redis) |
| `backend/tests/test_data_profiler.py` | DataProfilerAgent logic |
| `backend/tests/test_integration.py` | Live server smoke tests via HTTP |

### Writing Tests

- **Every bug fix** must include a regression test
- **New features** should have unit + integration tests
- Unit test files go in `backend/tests/` and mock all external services via `conftest.py`
- Integration tests go in `backend/tests/test_integration.py` and must tolerate a missing server (use `@server_available`)
- Use descriptive test names: `test_data_profiler_handles_missing_columns`

**Backend test example:**
```python
def test_chart_recommender_selects_scatter_for_correlation(sample_dataset):
    """Chart recommender should suggest scatter plot for correlated numeric columns."""
    agent = ChartRecommenderAgent(timeout=30)
    result = agent.analyze(sample_dataset)
    
    assert result.recommendations[0].chart_type == "scatter"
    assert result.confidence > 0.8
```

## Environment Variables Reference

See `.env.example` for the full list of required variables. Key secrets:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI analysis |
| `SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key — safe for frontend (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Supabase secret key — backend only (`sb_secret_...`) |

## Getting Help

- **Issues**: Browse existing issues or create a new one
- **Discussions**: For questions and ideas (GitHub Discussions)
- **Discord**: Join our community (link TBD)

## Code of Conduct

Be respectful, inclusive, and collaborative. See `CODE_OF_CONDUCT.md` for details.

---

Thank you for contributing! 🚀
