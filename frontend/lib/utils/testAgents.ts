// Test script for agent functionality
import { DataProfilerAgent } from '../agents/DataProfilerAgent';
import { PatternRecognizerAgent } from '../agents/PatternRecognizerAgent';
import { VisualizationRecommenderAgent } from '../agents/VisualizationRecommenderAgent';

const sampleData = [
  { date: '2024-01-01', product: 'Widget A', sales: 1200, quantity: 50, category: 'Electronics' },
  { date: '2024-01-02', product: 'Widget B', sales: 800, quantity: 30, category: 'Home' },
  { date: '2024-01-03', product: 'Widget C', sales: 1500, quantity: 45, category: 'Electronics' },
  { date: '2024-01-04', product: 'Widget A', sales: 1100, quantity: 48, category: 'Electronics' },
  { date: '2024-01-05', product: 'Widget B', sales: 950, quantity: 35, category: 'Home' }
];

export async function testAgents() {
  console.log('Testing Agent Pipeline...');

  try {
    // Test Data Profiler
    const profiler = new DataProfilerAgent();
    const profile = await profiler.analyze(sampleData);
    console.log('Data Profile:', profile);

    // Test Pattern Recognizer
    const pattern = new PatternRecognizerAgent();
    const patterns = await pattern.analyze(sampleData, profile);
    console.log('Patterns:', patterns);

    // Test Visualization Recommender
    const recommender = new VisualizationRecommenderAgent();
    const recommendations = await recommender.recommend(profile, patterns);
    console.log('Recommendations:', recommendations);

    return { profile, patterns, recommendations };
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}