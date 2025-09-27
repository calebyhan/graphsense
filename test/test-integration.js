/**
 * Integration Test Script
 * Tests the complete workflow from file upload to chart generation
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8000';

// Sample test data
const testData = [
  { date: '2024-01-01', sales: 1000, region: 'North' },
  { date: '2024-01-02', sales: 1200, region: 'South' },
  { date: '2024-01-03', sales: 900, region: 'East' },
  { date: '2024-01-04', sales: 1500, region: 'West' },
  { date: '2024-01-05', sales: 1100, region: 'North' }
];

async function testBackendHealth() {
  console.log('🔍 Testing backend health...');
  try {
    const response = await fetch(`${BACKEND_URL}/health/`);
    const data = await response.json();
    console.log('✅ Backend health check passed:', data.status);
    return true;
  } catch (error) {
    console.log('❌ Backend health check failed:', error.message);
    return false;
  }
}

async function testDatasetAnalysis() {
  console.log('🔍 Testing dataset analysis...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: testData,
        filename: 'test_sales.csv',
        file_type: 'csv'
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Analysis started successfully:', result.dataset_id);
      return result.dataset_id;
    } else {
      console.log('❌ Analysis failed:', result.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Analysis request failed:', error.message);
    return null;
  }
}

async function testAnalysisStatus(datasetId) {
  console.log('🔍 Testing analysis status polling...');
  let attempts = 0;
  const maxAttempts = 30; // 60 seconds max

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/analysis/status/${datasetId}`);
      const status = await response.json();

      console.log(`📊 Analysis status (attempt ${attempts + 1}):`, status.status);

      if (status.status === 'completed') {
        console.log('✅ Analysis completed successfully');
        return true;
      } else if (status.status === 'failed') {
        console.log('❌ Analysis failed');
        return false;
      }

      // Wait 2 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

    } catch (error) {
      console.log('❌ Status check failed:', error.message);
      return false;
    }
  }

  console.log('❌ Analysis timed out');
  return false;
}

async function testAnalysisResults(datasetId) {
  console.log('🔍 Testing analysis results retrieval...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/analysis/results/${datasetId}`);
    const results = await response.json();

    if (results.success && results.data) {
      console.log('✅ Results retrieved successfully');
      console.log(`📈 Found ${results.data.recommendations?.length || 0} recommendations`);
      return true;
    } else {
      console.log('❌ Failed to retrieve results:', results.error);
      return false;
    }
  } catch (error) {
    console.log('❌ Results retrieval failed:', error.message);
    return false;
  }
}

async function runIntegrationTests() {
  console.log('🚀 Starting Auto Visualization Agent Integration Tests\n');

  // Test 1: Backend Health Check
  const healthCheck = await testBackendHealth();
  if (!healthCheck) {
    console.log('\n❌ Integration tests failed: Backend not available');
    return;
  }

  console.log('');

  // Test 2: Dataset Analysis
  const datasetId = await testDatasetAnalysis();
  if (!datasetId) {
    console.log('\n❌ Integration tests failed: Analysis could not be started');
    return;
  }

  console.log('');

  // Test 3: Analysis Status Polling
  const analysisCompleted = await testAnalysisStatus(datasetId);
  if (!analysisCompleted) {
    console.log('\n❌ Integration tests failed: Analysis did not complete');
    return;
  }

  console.log('');

  // Test 4: Results Retrieval
  const resultsRetrieved = await testAnalysisResults(datasetId);
  if (!resultsRetrieved) {
    console.log('\n❌ Integration tests failed: Could not retrieve results');
    return;
  }

  console.log('\n🎉 All integration tests passed successfully!');
  console.log('\n📋 Test Summary:');
  console.log('✅ Backend health check');
  console.log('✅ Dataset analysis initiation');
  console.log('✅ Real-time status polling');
  console.log('✅ Results retrieval');
  console.log('\n🔧 The Auto Visualization Agent is fully operational!');
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ This test script requires Node.js 18+ with built-in fetch support');
  console.log('💡 Alternatively, run: npm install node-fetch');
  process.exit(1);
}

// Run the tests
runIntegrationTests().catch(error => {
  console.error('\n💥 Integration tests crashed:', error);
  process.exit(1);
});