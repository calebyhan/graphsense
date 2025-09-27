import { ChartRecommendation, DataProfile, Pattern, ChartConfig } from '@/lib/types';

export class VisualizationRecommenderAgent {
  async recommend(profile: DataProfile, patterns: Pattern[]): Promise<ChartRecommendation[]> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1800));

    const recommendations: ChartRecommendation[] = [];

    const numericColumns = profile.columns.filter(col => col.type === 'numeric');
    const categoricalColumns = profile.columns.filter(col => col.type === 'categorical');
    const temporalColumns = profile.columns.filter(col => col.type === 'temporal');

    // Generate recommendations based on data characteristics
    if (temporalColumns.length > 0 && numericColumns.length > 0) {
      recommendations.push(...this.recommendTimeSeriesCharts(temporalColumns, numericColumns, patterns));
    }

    if (categoricalColumns.length > 0 && numericColumns.length > 0) {
      recommendations.push(...this.recommendCategoricalCharts(categoricalColumns, numericColumns, patterns));
    }

    if (numericColumns.length >= 2) {
      recommendations.push(...this.recommendScatterPlots(numericColumns, patterns));
    }

    if (categoricalColumns.length > 0) {
      recommendations.push(...this.recommendDistributionCharts(categoricalColumns, patterns));
    }

    // Sort by confidence and return top 3
    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  private recommendTimeSeriesCharts(
    temporalColumns: any[],
    numericColumns: any[],
    patterns: Pattern[]
  ): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];
    const timeCol = temporalColumns[0];

    numericColumns.forEach(numCol => {
      const trendPattern = patterns.find(p =>
        p.type === 'trend' && p.columns.includes(timeCol.name) && p.columns.includes(numCol.name)
      );

      const confidence = trendPattern ? 85 + (trendPattern.strength * 10) : 75;

      recommendations.push({
        chartType: 'line',
        confidence,
        justification: trendPattern
          ? `Line chart recommended due to ${trendPattern.description.toLowerCase()}. Ideal for showing temporal progression.`
          : `Line chart suitable for temporal data showing ${numCol.name} changes over ${timeCol.name}. Good for trend analysis.`,
        config: {
          xAxis: timeCol.name,
          yAxis: numCol.name,
          title: `${numCol.name} over ${timeCol.name}`,
          data: []
        }
      });
    });

    return recommendations;
  }

  private recommendCategoricalCharts(
    categoricalColumns: any[],
    numericColumns: any[],
    patterns: Pattern[]
  ): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];
    const catCol = categoricalColumns[0];

    numericColumns.forEach(numCol => {
      const distributionPattern = patterns.find(p =>
        p.type === 'distribution' && p.columns.includes(catCol.name)
      );

      // Recommend bar chart
      const barConfidence = distributionPattern ? 80 + (distributionPattern.strength * 15) : 70;
      recommendations.push({
        chartType: 'bar',
        confidence: barConfidence,
        justification: distributionPattern
          ? `Bar chart recommended due to ${distributionPattern.description.toLowerCase()}. Excellent for comparing categorical values.`
          : `Bar chart ideal for comparing ${numCol.name} across different ${catCol.name} categories. Clear visual comparison.`,
        config: {
          xAxis: catCol.name,
          yAxis: numCol.name,
          title: `${numCol.name} by ${catCol.name}`,
          data: []
        }
      });

      // Consider pie chart for single categorical variable with few categories
      if (catCol.uniqueValues && catCol.uniqueValues <= 6) {
        recommendations.push({
          chartType: 'pie',
          confidence: 65,
          justification: `Pie chart suitable for showing proportional breakdown of ${numCol.name} across ${catCol.name} categories. Best for part-to-whole relationships.`,
          config: {
            category: catCol.name,
            value: numCol.name,
            title: `Distribution of ${numCol.name} by ${catCol.name}`,
            data: []
          }
        });
      }
    });

    return recommendations;
  }

  private recommendScatterPlots(
    numericColumns: any[],
    patterns: Pattern[]
  ): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];

    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i];
        const col2 = numericColumns[j];

        const correlationPattern = patterns.find(p =>
          p.type === 'correlation' &&
          p.columns.includes(col1.name) &&
          p.columns.includes(col2.name)
        );

        const confidence = correlationPattern ? 75 + (correlationPattern.strength * 20) : 60;

        recommendations.push({
          chartType: 'scatter',
          confidence,
          justification: correlationPattern
            ? `Scatter plot recommended due to ${correlationPattern.description.toLowerCase()}. Perfect for visualizing relationships between variables.`
            : `Scatter plot useful for exploring relationship between ${col1.name} and ${col2.name}. Good for identifying correlations and outliers.`,
          config: {
            xAxis: col1.name,
            yAxis: col2.name,
            title: `${col2.name} vs ${col1.name}`,
            data: []
          }
        });
      }
    }

    return recommendations;
  }

  private recommendDistributionCharts(
    categoricalColumns: any[],
    patterns: Pattern[]
  ): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];

    categoricalColumns.forEach(col => {
      const distributionPattern = patterns.find(p =>
        p.type === 'distribution' && p.columns.includes(col.name)
      );

      if (distributionPattern && distributionPattern.strength > 0.6) {
        recommendations.push({
          chartType: 'bar',
          confidence: 70,
          justification: `Bar chart recommended for ${col.name} distribution. ${distributionPattern.description} - useful for identifying dominant categories.`,
          config: {
            xAxis: col.name,
            yAxis: 'Count',
            title: `Distribution of ${col.name}`,
            data: []
          }
        });
      }
    });

    return recommendations;
  }
}