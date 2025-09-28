// Test script for duplicate prevention
// Open browser console and run this to test the duplicate prevention

async function testDuplicatePrevention() {
  console.log('🧪 Testing duplicate prevention...');
  
  const testData = [
    { name: 'Test 1', value: 100 },
    { name: 'Test 2', value: 200 },
    { name: 'Test 3', value: 300 }
  ];
  
  const filename = 'test-duplicate-prevention.csv';
  
  try {
    console.log('📡 Making first analysis request...');
    const promise1 = fetch('http://localhost:8000/api/analysis/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: testData, filename })
    });
    
    console.log('📡 Making second analysis request (should be deduplicated)...');
    const promise2 = fetch('http://localhost:8000/api/analysis/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: testData, filename })
    });
    
    const [response1, response2] = await Promise.all([promise1, promise2]);
    
    const result1 = await response1.json();
    const result2 = await response2.json();
    
    console.log('📊 First request result:', result1);
    console.log('📊 Second request result:', result2);
    
    if (result1.dataset_id === result2.dataset_id) {
      console.log('✅ SUCCESS: Duplicate prevention working! Same dataset ID returned.');
    } else {
      console.log('❌ FAILED: Different dataset IDs created:', {
        first: result1.dataset_id,
        second: result2.dataset_id
      });
    }
    
    return { result1, result2 };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDuplicatePrevention();

console.log('💡 Usage: Open your app, upload a file, and check that only ONE set of analysis requests is made in the Network tab.');