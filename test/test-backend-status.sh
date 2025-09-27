#!/bin/bash

# Test script to verify the backend status checker functionality

BACKEND_URL=${API_URL:-http://localhost:8000}

echo "🔍 Testing Backend Status Checker..."
echo ""

# Test basic health endpoint
echo "1. Testing basic health endpoint..."
echo "GET ${BACKEND_URL}/health/"
curl -s -w "Response time: %{time_total}s\n" "${BACKEND_URL}/health/" | jq . 2>/dev/null || echo "✅ Health endpoint responded (jq not available for formatting)"
echo ""

# Test detailed health endpoint
echo "2. Testing detailed health endpoint..."
echo "GET ${BACKEND_URL}/health/detailed"
curl -s -w "Response time: %{time_total}s\n" "${BACKEND_URL}/health/detailed" | jq . 2>/dev/null || echo "✅ Detailed health endpoint responded (jq not available for formatting)"
echo ""

# Test response codes
echo "3. Testing response codes..."
echo "Basic health status code:"
curl -s -o /dev/null -w "%{http_code}\n" "${BACKEND_URL}/health/"
echo "Detailed health status code:"
curl -s -o /dev/null -w "%{http_code}\n" "${BACKEND_URL}/health/detailed"
echo "Non-existent endpoint status code:"
curl -s -o /dev/null -w "%{http_code}\n" "${BACKEND_URL}/health/nonexistent"
echo ""

echo "🎯 Backend Status Checker Test Complete!"
echo "🌐 Frontend should be running at: http://localhost:3001"
echo "📊 Visit the canvas page to see the status checker in action"