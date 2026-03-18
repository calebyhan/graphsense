# CI/CD Setup Guide

This document explains the repository CI/CD and AI review setup.

## Overview

GraphSense uses GitHub Actions for automated checks and native GitHub Copilot for PR review comments.

## Workflows

### 1. PR Checks (`.github/workflows/pr-checks.yml`)

Triggers: pull requests and pushes to `main` and `develop`.

Jobs:
1. `Backend Tests`: runs `pytest` with coverage, uploads coverage artifacts.
2. `Frontend Lint`: runs lint + TypeScript checks.
3. `Integration Tests`: starts backend and runs integration tests.
4. `Docker Build Test`: validates backend/frontend Docker builds.
5. `PR Summary`: fails if any required job fails.

### 2. AI and Static Analysis (`.github/workflows/ai-code-review.yml`)

Triggers: pull requests (`opened`, `synchronize`, `reopened`).

Jobs:
1. `Complexity and Security Analysis`: runs `radon` and `bandit` and uploads reports.

## Copilot Code Reviews

Copilot code review is a GitHub PR feature, not a standard Actions status check.

How to use:
1. Open a PR.
2. Open `Reviewers`.
3. Select `Copilot`.

Optional auto-review:
- Enable automatic Copilot reviews in GitHub settings.

Important:
- Copilot leaves comment reviews only.
- Copilot comments do not count as required human approvals.
- Copilot alone cannot block merge.

Review customization:
- Repository instructions live in `.github/copilot-instructions.md`.

## Required GitHub Secrets

Add under `Settings` -> `Secrets and variables` -> `Actions`.

| Secret | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Backend/integration tests that exercise AI paths |
| `SUPABASE_URL` | Yes | Backend/integration tests with DB access |
| `SUPABASE_SECRET_KEY` | Yes | Backend privileged DB access in tests |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional | Frontend build/runtime config |

Notes:
- Use test credentials, not production secrets.
- No OpenAI secret is required for Copilot code review.

## Why Secrets Are Needed

CI runs real application flows:
- AI agent paths call Gemini.
- Data paths access Supabase.
- Integration tests validate full request/response behavior.

Without these secrets, integration-level checks fail.

## Coverage (No Codecov Required)

`pytest` handles coverage directly.

Local:
```bash
cd backend
pytest --cov=app --cov-report=term --cov-report=html
open htmlcov/index.html
```

CI:
- Coverage summary appears in logs.
- `coverage.xml` and `htmlcov/` are uploaded as Actions artifacts.

## Test Environment Strategy

### Option 1 (Recommended): Separate Supabase Test Project

1. Create `graphsense-test` in Supabase.
2. Apply the same migrations as production.
3. Put test project credentials in GitHub secrets.

Benefits:
- Free-tier compatible.
- Isolated from production.
- Safer test data handling.

### Option 2: Supabase Branching (Pro Plan)

If using Supabase Pro, preview branches are supported.
See Supabase preview branching docs if you upgrade to Pro.

### Option 3: Local Database Service

Run local DB service for tests in CI or local Docker setups.

## Local Validation

Run before pushing:
```bash
./scripts/pre-push.sh
```

Common commands:
```bash
cd backend && pytest -v
cd backend && pytest --cov=app --cov-report=term --cov-report=html
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
```

## Branch Protection

Recommended required status checks:
- `Backend Tests`
- `Frontend Lint`
- `Integration Tests`
- `Docker Build Test`
- `Complexity and Security Analysis`

Keep required human approvals enabled. Copilot comments are advisory.

## Troubleshooting

### Status checks missing

- Verify workflow files exist on the target branch.
- Verify `on:` branch filters include your branch.
- Check the Actions tab for run failures.

### Secret-related failures

- Confirm names are exact.
- Ensure values are from test environment.
- Add the same secrets to Dependabot secrets if Dependabot PRs need them.

### Copilot review missing

- Request Copilot from PR `Reviewers` manually.
- Or enable automatic Copilot reviews in repository settings.
- Ensure Copilot code review is enabled for your org/repo.

## Badges

```markdown
[![CI](https://github.com/calebyhan/graphsense/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/calebyhan/graphsense/actions/workflows/pr-checks.yml)
[![AI and Static Analysis](https://github.com/calebyhan/graphsense/actions/workflows/ai-code-review.yml/badge.svg)](https://github.com/calebyhan/graphsense/actions/workflows/ai-code-review.yml)
```
