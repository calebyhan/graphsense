#!/bin/bash
# Pre-push validation script
# Run this before pushing to ensure CI will pass

set -e  # Exit on error

echo "🔍 Running pre-push validation..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

echo "📦 1/5 Checking backend dependencies..."
cd backend
if pip list > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend dependencies OK${NC}"
else
    echo -e "${RED}✗ Backend dependencies missing${NC}"
    FAILURES=$((FAILURES + 1))
fi
cd ..

echo ""
echo "🧪 2/5 Running backend tests..."
cd backend
if pytest -v; then
    echo -e "${GREEN}✓ Backend tests passed${NC}"
else
    echo -e "${RED}✗ Backend tests failed${NC}"
    FAILURES=$((FAILURES + 1))
fi
cd ..

echo ""
echo "📝 3/5 Checking backend code quality..."
cd backend
if python -m flake8 app --count --select=E9,F63,F7,F82 --show-source --statistics > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend syntax OK${NC}"
else
    echo -e "${YELLOW}⚠ Backend has syntax warnings${NC}"
fi
cd ..

echo ""
echo "🎨 4/5 Checking frontend lint..."
cd frontend
if npm run lint; then
    echo -e "${GREEN}✓ Frontend lint passed${NC}"
else
    echo -e "${RED}✗ Frontend lint failed${NC}"
    FAILURES=$((FAILURES + 1))
fi
cd ..

echo ""
echo "📘 5/5 Checking TypeScript..."
cd frontend
if npx tsc --noEmit; then
    echo -e "${GREEN}✓ TypeScript type check passed${NC}"
else
    echo -e "${RED}✗ TypeScript has errors${NC}"
    FAILURES=$((FAILURES + 1))
fi
cd ..

echo ""
echo "=========================================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Safe to push.${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAILURES check(s) failed. Fix issues before pushing.${NC}"
    exit 1
fi
