// Enhanced script to clean up duplicate datasets in Supabase
// Open your browser console on localhost:3000 and paste this script

(async function cleanupDuplicateDatasets() {
  console.log('🧹 Starting enhanced duplicate dataset cleanup...');
  
  try {
    // Check if we're running in the browser on localhost
    if (typeof window === 'undefined' || !window.location.hostname.includes('localhost')) {
      console.error('❌ This script must be run in browser console on localhost');
      return;
    }
    
    // Fetch all datasets for null user (dev mode)
    console.log('📡 Fetching datasets from backend...');
    const response = await fetch('http://localhost:8000/api/datasets?user_id=null');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const datasets = data.datasets || [];
    
    console.log(`📊 Found ${datasets.length} total datasets`);
    
    // Group by filename to find duplicates
    const grouped = {};
    datasets.forEach(dataset => {
      const filename = dataset.filename;
      if (!grouped[filename]) {
        grouped[filename] = [];
      }
      grouped[filename].push(dataset);
    });
    
    // Find duplicates and keep only the newest one
    const toDelete = [];
    const duplicateGroups = [];
    
    Object.entries(grouped).forEach(([filename, datasetGroup]) => {
      if (datasetGroup.length > 1) {
        console.log(`🔍 Found ${datasetGroup.length} duplicates for: ${filename}`);
        duplicateGroups.push({ filename, datasets: datasetGroup });
        
        // Sort by created_at descending (newest first)
        datasetGroup.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Keep the first (newest), mark others for deletion
        const toKeep = datasetGroup[0];
        const duplicates = datasetGroup.slice(1);
        
        console.log(`✅ Keeping: ${toKeep.id} (${toKeep.created_at})`);
        duplicates.forEach(dup => {
          console.log(`❌ Marking for deletion: ${dup.id} (${dup.created_at})`);
          toDelete.push(dup);
        });
      }
    });
    
    if (duplicateGroups.length === 0) {
      console.log('✨ No duplicates found! Your database is clean.');
      return;
    }
    
    // Show summary
    console.log('📋 CLEANUP SUMMARY:');
    console.log(`   • ${duplicateGroups.length} files have duplicates`);
    console.log(`   • ${toDelete.length} duplicate datasets will be removed`);
    console.log(`   • ${datasets.length - toDelete.length} datasets will remain`);
    
    // Confirm before deletion
    const shouldProceed = confirm(`Delete ${toDelete.length} duplicate datasets? This cannot be undone.`);
    
    if (!shouldProceed) {
      console.log('🛑 Cleanup cancelled by user');
      return;
    }
    
    // Delete duplicates
    console.log(`🗑️ Deleting ${toDelete.length} duplicate datasets...`);
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const dataset of toDelete) {
      try {
        const deleteResponse = await fetch(`http://localhost:8000/api/datasets/${dataset.id}`, {
          method: 'DELETE'
        });
        
        if (deleteResponse.ok) {
          console.log(`✅ Deleted: ${dataset.filename} (${dataset.id})`);
          deletedCount++;
        } else {
          console.error(`❌ Failed to delete: ${dataset.filename} (${dataset.id})`);
          failedCount++;
        }
      } catch (error) {
        console.error(`❌ Error deleting ${dataset.filename}:`, error);
        failedCount++;
      }
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('🎉 CLEANUP COMPLETE!');
    console.log(`   • Successfully deleted: ${deletedCount} datasets`);
    console.log(`   • Failed to delete: ${failedCount} datasets`);
    console.log(`   • Remaining datasets: ${datasets.length - deletedCount}`);
    
    if (failedCount > 0) {
      console.log('⚠️ Some datasets could not be deleted. Check the logs above for details.');
    }
    
    // Suggest refreshing the page
    console.log('💡 Tip: Refresh the page to see the updated dataset list');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    console.log('🔧 Make sure your backend is running on localhost:8000');
  }
})();

// Usage instructions:
console.log(`
🚀 DUPLICATE CLEANUP TOOL
========================
1. Make sure your backend is running (docker-compose up)
2. Open browser console on localhost:3000 
3. Paste and run this script
4. Confirm when prompted
5. Refresh the page when done
`);