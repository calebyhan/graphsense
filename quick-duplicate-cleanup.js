// Quick cleanup script to remove duplicate datasets
// Run this in browser console on localhost:3000

(async function quickCleanup() {
  console.log('🧹 Quick duplicate cleanup...');
  
  try {
    // Fetch all datasets
    const response = await fetch('http://localhost:8000/api/datasets?user_id=null');
    const data = await response.json();
    const datasets = data.datasets || [];
    
    console.log(`📊 Found ${datasets.length} datasets`);
    
    // Group by filename
    const grouped = {};
    datasets.forEach(dataset => {
      const filename = dataset.filename;
      if (!grouped[filename]) grouped[filename] = [];
      grouped[filename].push(dataset);
    });
    
    // Find duplicates
    const duplicates = Object.entries(grouped)
      .filter(([filename, datasets]) => datasets.length > 1)
      .map(([filename, datasets]) => ({ filename, datasets }));
    
    console.log(`🔍 Found ${duplicates.length} sets of duplicates`);
    
    // Remove duplicates (keep the one with data, remove empty ones)
    for (const { filename, datasets } of duplicates) {
      console.log(`\n📁 Processing duplicates for: ${filename}`);
      
      // Sort by data completeness (prefer datasets with actual data)
      const sorted = datasets.sort((a, b) => {
        const aHasData = (a.metadata?.row_count || 0) > 0;
        const bHasData = (b.metadata?.row_count || 0) > 0;
        return bHasData - aHasData; // Keep ones with data first
      });
      
      // Keep the first (best) one, remove the rest
      const toKeep = sorted[0];
      const toRemove = sorted.slice(1);
      
      console.log(`✅ Keeping: ${toKeep.id} (${toKeep.metadata?.row_count || 0} rows)`);
      
      for (const dataset of toRemove) {
        console.log(`🗑️ Removing: ${dataset.id} (${dataset.metadata?.row_count || 0} rows)`);
        try {
          await fetch(`http://localhost:8000/api/datasets/${dataset.id}`, { method: 'DELETE' });
          console.log(`✅ Deleted ${dataset.id}`);
        } catch (error) {
          console.error(`❌ Failed to delete ${dataset.id}:`, error);
        }
      }
    }
    
    console.log('✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
})();