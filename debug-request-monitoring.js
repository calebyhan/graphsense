// Request Monitoring Script
// Run this in browser console to monitor API requests during upload

let requestLog = [];
let originalFetch = window.fetch;

// Override fetch to log requests
window.fetch = function(...args) {
  const url = args[0];
  const options = args[1] || {};
  const method = options.method || 'GET';
  
  // Log API requests
  if (url.includes('/api/')) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      method,
      url,
      body: options.body ? JSON.parse(options.body) : null
    };
    
    requestLog.push(logEntry);
    console.log(`🌐 ${method} ${url}`, logEntry);
  }
  
  return originalFetch.apply(this, args);
};

// Monitor React render cycles
let renderCount = 0;
const originalConsoleLog = console.log;

// Helper function to show request summary
function showRequestSummary() {
  console.log('\n📊 REQUEST SUMMARY:');
  console.log('==================');
  
  const postRequests = requestLog.filter(r => r.method === 'POST');
  const patchRequests = requestLog.filter(r => r.method === 'PATCH');
  
  console.log(`POST requests: ${postRequests.length}`);
  postRequests.forEach((req, i) => {
    console.log(`  ${i+1}. ${req.url} at ${req.timestamp}`);
  });
  
  console.log(`PATCH requests: ${patchRequests.length}`);
  patchRequests.forEach((req, i) => {
    console.log(`  ${i+1}. ${req.url} at ${req.timestamp}`);
  });
  
  console.log('\n🎯 EXPECTED:');
  console.log('- 1 POST to /api/analysis/analyze');
  console.log('- 3-4 database updates (not visible in browser, happens on backend)');
}

// Clear log function
function clearRequestLog() {
  requestLog = [];
  console.log('🧹 Request log cleared');
}

// Auto-show summary after uploads
setTimeout(() => {
  console.log('\n📋 Request monitoring active!');
  console.log('Upload a file, then run: showRequestSummary()');
  console.log('To clear log: clearRequestLog()');
}, 1000);

// Make functions globally available
window.showRequestSummary = showRequestSummary;
window.clearRequestLog = clearRequestLog;
window.getRequestLog = () => requestLog;