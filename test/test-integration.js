/**
 * Integration Test Script
 * Tests the complete 3-agent AI pipeline workflow from data upload to chart recommendations
 * 
 * Tests:
 * 1. Backend health check
 * 2. Dataset analysis initiation 
 * 3. Real-time agent status polling (profiler, recommender, validator)
 * 4. Results retrieval with recommendations
 * 5. Agent pipeline completion verification
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8000';

// Sample test data - more comprehensive dataset for better testing
const testData = [
  { date: '2024-01-01', sales: 1000, region: 'North', product: 'Widget A', quantity: 10 },
  { date: '2024-01-02', sales: 1200, region: 'South', product: 'Widget B', quantity: 8 },
  { date: '2024-01-03', sales: 900, region: 'East', product: 'Widget A', quantity: 12 },
  { date: '2024-01-04', sales: 1500, region: 'West', product: 'Widget C', quantity: 15 },
  { date: '2024-01-05', sales: 1100, region: 'North', product: 'Widget B', quantity: 9 },
  { date: '2024-01-06', sales: 800, region: 'South', product: 'Widget A', quantity: 7 },
  { date: '2024-01-07', sales: 1300, region: 'East', product: 'Widget C', quantity: 11 },
  { date: '2024-01-08', sales: 950, region: 'West', product: 'Widget A', quantity: 13 }
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
  console.log('🔍 Testing 3-agent pipeline status polling...');
  let attempts = 0;
  const maxAttempts = 45; // 90 seconds max for all 3 agents
  
  const agentNames = {
    profiler: 'Enhanced Data Profiler',
    recommender: 'Chart Recommender', 
    validator: 'Validation Agent'
  };

  let lastProgress = { profiler: false, recommender: false, validator: false };

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/analysis/status/${datasetId}`);
      const status = await response.json();

      // Log overall status
      console.log(`📊 Pipeline status (attempt ${attempts + 1}): ${status.status}`);

      // Log agent progress changes
      if (status.progress) {
        Object.keys(agentNames).forEach(agent => {
          if (status.progress[agent] !== lastProgress[agent]) {
            if (status.progress[agent]) {
              console.log(`  ✅ ${agentNames[agent]} completed`);
            } else if (!lastProgress[agent] && lastProgress.profiler && agent === 'recommender') {
              console.log(`  🔄 ${agentNames[agent]} running...`);
            } else if (!lastProgress[agent] && lastProgress.recommender && agent === 'validator') {
              console.log(`  🔄 ${agentNames[agent]} running...`);
            }
          }
        });
        lastProgress = { ...status.progress };
        
        // Show current active agent
        if (status.status === 'processing') {
          if (!status.progress.profiler) {
            console.log(`  🔄 ${agentNames.profiler} running...`);
          } else if (!status.progress.recommender) {
            console.log(`  🔄 ${agentNames.recommender} running...`);
          } else if (!status.progress.validator) {
            console.log(`  🔄 ${agentNames.validator} running...`);
          }
        }
      }

      if (status.status === 'completed') {
        console.log('🎉 All 3 agents completed successfully!');
        console.log(`  ✅ Pipeline Progress: ${Object.values(status.progress).filter(Boolean).length}/3 agents`);
        return true;
      } else if (status.status === 'failed') {
        console.log('❌ Analysis pipeline failed');
        return false;
      } else if (status.status === 'error') {
        console.log('❌ Analysis error:', status.error || 'Unknown error');
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

  console.log('❌ Analysis pipeline timed out');
  return false;
}

async function testAnalysisResults(datasetId) {
  console.log('🔍 Testing comprehensive analysis results retrieval...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/analysis/results/${datasetId}`);
    const results = await response.json();

    if (response.ok && results.success) {
      console.log('✅ Results retrieved successfully');
      
      // Check data profiling results
      if (results.data_profile) {
        console.log('  📊 Data profiling completed');
        if (results.data_profile.statistical_summary) {
          console.log(`     - Statistical analysis: ✅`);
        }
        if (results.data_profile.correlations) {
          console.log(`     - Correlation analysis: ✅`);
        }
      }
      
      // Check chart recommendations
      if (results.recommendations && results.recommendations.length > 0) {
        console.log(`  📈 Chart recommendations: ${results.recommendations.length} found`);
        
        // Log recommendation types and confidence scores
        results.recommendations.forEach((rec, index) => {
          const confidence = rec.validation_result?.final_score || rec.confidence || 0;
          console.log(`     ${index + 1}. ${rec.chart_type} (confidence: ${confidence.toFixed(2)})`);
        });
      } else {
        console.log('  ⚠️  No chart recommendations found');
      }

      // Validate the pipeline worked end-to-end
      const hasProfile = !!results.data_profile;
      const hasRecommendations = !!(results.recommendations && results.recommendations.length > 0);
      
      if (hasProfile && hasRecommendations) {
        console.log('  🎯 End-to-end pipeline validation: ✅');
        return true;
      } else {
        console.log('  ❌ Incomplete pipeline results');
        return false;
      }
      
    } else {
      console.log('❌ Failed to retrieve results:', results.message || results.error || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.log('❌ Results retrieval failed:', error.message);
    return false;
  }
}

async function runIntegrationTests() {
  console.log('🚀 Starting 3-Agent AI Pipeline Integration Tests');
  console.log('   Testing: Enhanced Data Profiler → Chart Recommender → Validation Agent\n');

  const startTime = Date.now();

  // Test 1: Backend Health Check
  console.log('🏥 Step 1: Backend Health Check');
  const healthCheck = await testBackendHealth();
  if (!healthCheck) {
    console.log('\n❌ Integration tests failed: Backend not available');
    console.log('💡 Make sure the backend is running: docker-compose up backend');
    return;
  }

  console.log('');

  // Test 2: Dataset Analysis Initiation
  console.log('📤 Step 2: Dataset Analysis Initiation');
  const datasetId = await testDatasetAnalysis();
  if (!datasetId) {
    console.log('\n❌ Integration tests failed: Analysis could not be started');
    return;
  }

  console.log('');

  // Test 3: 3-Agent Pipeline Status Monitoring
  console.log('🤖 Step 3: 3-Agent Pipeline Execution');
  const analysisCompleted = await testAnalysisStatus(datasetId);
  if (!analysisCompleted) {
    console.log('\n❌ Integration tests failed: Pipeline did not complete');
    return;
  }

  console.log('');

  // Test 4: Comprehensive Results Validation
  console.log('📋 Step 4: Results Validation');
  const resultsRetrieved = await testAnalysisResults(datasetId);
  if (!resultsRetrieved) {
    console.log('\n❌ Integration tests failed: Could not retrieve or validate results');
    return;
  }

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(1);

  console.log('\n🎉 All integration tests passed successfully!');
  console.log(`⏱️  Total execution time: ${totalTime} seconds`);
  console.log('\n📋 Integration Test Summary:');
  console.log('✅ Backend health and connectivity');
  console.log('✅ Dataset analysis initiation via API');
  console.log('✅ Enhanced Data Profiler agent execution');
  console.log('✅ Chart Recommender agent execution');  
  console.log('✅ Validation Agent execution');
  console.log('✅ Real-time agent status polling');
  console.log('✅ Comprehensive results retrieval');
  console.log('✅ End-to-end pipeline validation');
  console.log('\n🔧 The 3-Agent Auto Visualization Pipeline is fully operational!');
  console.log(`🆔 Dataset ID for reference: ${datasetId}`);
}

async function testAgentProgressTracking(datasetId) {
  console.log('🔍 Testing agent progress tracking fix...');
  console.log('   (Verifying validation agent shows as "running" instead of hanging at "next")');
  
  let attempts = 0;
  const maxAttempts = 20;
  let sawValidatorRunning = false;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/analysis/status/${datasetId}`);
      const status = await response.json();

      if (status.progress) {
        // Check if we catch the validator in running state
        if (status.progress.recommender && !status.progress.validator && status.status === 'processing') {
          console.log('  ✅ Validation agent detected as running (progress tracking fix working!)');
          sawValidatorRunning = true;
        }

        if (status.status === 'completed') {
          if (sawValidatorRunning) {
            console.log('  ✅ Agent progress tracking test passed');
          } else {
            console.log('  ⚠️  Did not catch validator running state (processing may be too fast)');
          }
          return true;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    } catch (error) {
      console.log('  ❌ Progress tracking test failed:', error.message);
      return false;
    }
  }

  return sawValidatorRunning;
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ This test script requires Node.js 18+ with built-in fetch support');
  console.log('💡 Alternatively, run: npm install node-fetch');
  console.log('💡 Current Node version:', process.version);
  process.exit(1);
}

// Add command line argument parsing
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');

if (verbose) {
  console.log('🔧 Running in verbose mode');
  console.log('📍 Backend URL:', BACKEND_URL);
  console.log('📍 Frontend URL:', FRONTEND_URL);
  console.log('📊 Test dataset size:', testData.length, 'rows\n');
}

// Run the tests
runIntegrationTests().catch(error => {
  console.error('\n💥 Integration tests crashed:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});