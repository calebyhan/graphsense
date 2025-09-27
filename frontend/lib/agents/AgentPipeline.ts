import { DataProfilerAgent } from './DataProfilerAgent';
import { PatternRecognizerAgent } from './PatternRecognizerAgent';
import { VisualizationRecommenderAgent } from './VisualizationRecommenderAgent';
import { AnalysisResult, DataProfile, Pattern, ChartRecommendation } from '@/lib/types';

export class AgentPipeline {
  private profiler: DataProfilerAgent;
  private pattern: PatternRecognizerAgent;
  private recommender: VisualizationRecommenderAgent;

  constructor(private onProgress: (agent: string, state: string) => void) {
    this.profiler = new DataProfilerAgent();
    this.pattern = new PatternRecognizerAgent();
    this.recommender = new VisualizationRecommenderAgent();
  }

  async analyze(data: any[]): Promise<AnalysisResult> {
    try {
      // Step 1: Profile data
      this.onProgress('profiler', 'running');
      const profile = await this.profiler.analyze(data);
      this.onProgress('profiler', 'complete');

      // Step 2: Recognize patterns
      this.onProgress('pattern', 'running');
      const patterns = await this.pattern.analyze(data, profile);
      this.onProgress('pattern', 'complete');

      // Step 3: Generate recommendations
      this.onProgress('recommender', 'running');
      const recommendations = await this.recommender.recommend(profile, patterns);
      this.onProgress('recommender', 'complete');

      // Step 4: Validation and filtering
      const validatedRecommendations = this.validateRecommendations(recommendations, data);

      return {
        profile,
        patterns,
        recommendations: validatedRecommendations
      };
    } catch (error) {
      console.error('Agent pipeline error:', error);
      throw error;
    }
  }

  private validateRecommendations(
    recommendations: ChartRecommendation[],
    data: any[]
  ): ChartRecommendation[] {
    return recommendations
      .filter(r => r.confidence > 50)
      .map(recommendation => ({
        ...recommendation,
        config: {
          ...recommendation.config,
          data: this.prepareChartData(recommendation, data)
        }
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  private prepareChartData(recommendation: ChartRecommendation, data: any[]): any[] {
    const { config } = recommendation;

    switch (recommendation.chartType) {
      case 'line':
      case 'bar':
        if (config.xAxis && config.yAxis) {
          return data
            .filter(row => row[config.xAxis!] != null && row[config.yAxis!] != null)
            .map(row => ({
              x: row[config.xAxis!],
              y: parseFloat(row[config.yAxis!]) || 0,
              [config.xAxis!]: row[config.xAxis!],
              [config.yAxis!]: parseFloat(row[config.yAxis!]) || 0
            }));
        }
        break;

      case 'scatter':
        if (config.xAxis && config.yAxis) {
          return data
            .filter(row =>
              row[config.xAxis!] != null &&
              row[config.yAxis!] != null &&
              !isNaN(parseFloat(row[config.xAxis!])) &&
              !isNaN(parseFloat(row[config.yAxis!]))
            )
            .map(row => ({
              x: parseFloat(row[config.xAxis!]),
              y: parseFloat(row[config.yAxis!]),
              [config.xAxis!]: parseFloat(row[config.xAxis!]),
              [config.yAxis!]: parseFloat(row[config.yAxis!])
            }));
        }
        break;

      case 'pie':
        if (config.category && config.value) {
          const aggregated = data.reduce((acc, row) => {
            const category = row[config.category!];
            const value = parseFloat(row[config.value!]) || 0;
            acc[category] = (acc[category] || 0) + value;
            return acc;
          }, {} as Record<string, number>);

          return Object.entries(aggregated).map(([name, value]) => ({
            name,
            value,
            [config.category!]: name,
            [config.value!]: value
          }));
        }
        break;

      default:
        return data.slice(0, 100); // Limit for performance
    }

    return [];
  }
}