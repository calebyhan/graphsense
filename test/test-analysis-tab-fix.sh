#!/bin/bash

# Test script for Dataset Panel Analysis Tab functionality
# Tests the fix for: "The analysis tab does not open after add dataset to canvas"

echo "🧪 Testing Dataset Panel Analysis Tab Fix"
echo "========================================"
echo ""

echo "✅ Expected Behavior After Fix:"
echo "1. Upload CSV file → Data parsed → Analysis starts automatically"
echo "2. Click 'Add Dataset to Canvas' → Analysis tab should open automatically if:"
echo "   - Recommendations already exist, OR"
echo "   - Analysis is in progress (any agent not idle)"
echo "3. Analysis tab should be clickable whenever there's raw data"
echo "4. Analysis tab should show:"
echo "   - 'Start Analysis' button if analysis hasn't started"
echo "   - 'Analysis in Progress' message if agents are running"
echo "   - Chart recommendations when analysis is complete"
echo ""

echo "🔧 Technical Changes Made:"
echo "1. Updated handleAddToCanvas() to auto-switch to analysis tab"
echo "2. Changed analysis tab enabled condition from 'recommendations' to 'rawData'"
echo "3. Added proper UI states for pre-analysis and in-progress scenarios"
echo "4. Added 'Start Analysis' button for manual analysis triggering"
echo ""

echo "🎯 Test Scenarios:"
echo "Scenario 1: Upload file → Add to canvas → Should show analysis tab with progress"
echo "Scenario 2: Upload file → Wait for completion → Add to canvas → Should show recommendations"
echo "Scenario 3: Upload file → Switch to analysis manually → Should show 'Start Analysis' or progress"
echo ""

echo "🚀 Test the fix by:"
echo "1. Opening http://localhost:3001/canvas"
echo "2. Clicking 'Load Sample Data' (top right)"
echo "3. Opening Dataset Panel (bottom toolbar)"
echo "4. Uploading a CSV file"
echo "5. Clicking 'Add Dataset to Canvas'"
echo "6. Verifying the analysis tab opens automatically"
echo ""

# Check if frontend is running
if curl -s http://localhost:3001 >/dev/null 2>&1; then
    echo "✅ Frontend is running at http://localhost:3001"
else
    echo "❌ Frontend is not running. Please start with: cd frontend && npm run dev"
fi

# Check if backend is running  
if curl -s http://localhost:8000/health/ >/dev/null 2>&1; then
    echo "✅ Backend is running at http://localhost:8000"
else
    echo "❌ Backend is not running. Please start with: docker-compose up backend -d"
fi

echo ""
echo "🎉 Ready to test! Open the browser and follow the test scenarios above."