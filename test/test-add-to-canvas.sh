#!/bin/bash

echo "Testing 'Add to Canvas' functionality..."
echo "========================================"

# Check if frontend is running on port 3001
if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ Frontend is running on http://localhost:3001"
else
    echo "❌ Frontend is not accessible"
    exit 1
fi

# Check if backend is running
if curl -s http://localhost:8000/health/ > /dev/null; then
    echo "✅ Backend is running on http://localhost:8000"
else
    echo "❌ Backend is not accessible"
    exit 1
fi

echo ""
echo "🧪 Test Steps:"
echo "1. Open http://localhost:3001/canvas in your browser"
echo "2. Click the 'Dataset' button in the toolbar to open the dataset panel"
echo "3. Click 'Load Sample Data' or upload a CSV file"
echo "4. Wait for the analysis to complete"
echo "5. In the Analysis tab, click 'Add to Canvas' on any chart recommendation"
echo "6. Verify that the chart appears on the canvas and is draggable"

echo ""
echo "🔍 Debug Info:"
echo "- Open browser developer tools (F12)"
echo "- Check the Console tab for any debug logs starting with 'handleAddToCanvas' or 'handleSelectChart'"
echo "- Look for any error messages"

echo ""
echo "✨ Expected Behavior:"
echo "- Charts should be added to canvas even if they don't have titles"
echo "- Fallback titles should be generated automatically"
echo "- Console logs should show successful chart addition"

echo ""
echo "🌐 Open the test page:"
open http://localhost:3001/canvas

echo "Test setup complete! Follow the steps above to test the functionality."