import { Pattern, DataProfile } from '@/lib/types';

export class PatternRecognizerAgent {
  async analyze(data: any[], profile: DataProfile): Promise<Pattern[]> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    const patterns: Pattern[] = [];

    // Analyze correlations between numeric columns
    const numericColumns = profile.columns.filter(col => col.type === 'numeric');
    if (numericColumns.length >= 2) {
      patterns.push(...this.findCorrelations(data, numericColumns));
    }

    // Analyze trends in temporal data
    const temporalColumns = profile.columns.filter(col => col.type === 'temporal');
    if (temporalColumns.length > 0) {
      patterns.push(...this.findTemporalTrends(data, temporalColumns, profile.columns));
    }

    // Analyze distributions in categorical data
    const categoricalColumns = profile.columns.filter(col => col.type === 'categorical');
    if (categoricalColumns.length > 0) {
      patterns.push(...this.findDistributionPatterns(data, categoricalColumns));
    }

    return patterns;
  }

  private findCorrelations(data: any[], numericColumns: any[]): Pattern[] {
    const correlations: Pattern[] = [];

    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i].name;
        const col2 = numericColumns[j].name;

        const correlation = this.calculateCorrelation(data, col1, col2);
        const absCorrelation = Math.abs(correlation);

        if (absCorrelation > 0.5) {
          correlations.push({
            type: 'correlation',
            description: `${correlation > 0 ? 'Positive' : 'Negative'} correlation between ${col1} and ${col2} (r=${correlation.toFixed(2)})`,
            strength: absCorrelation,
            columns: [col1, col2]
          });
        }
      }
    }

    return correlations;
  }

  private findTemporalTrends(data: any[], temporalColumns: any[], allColumns: any[]): Pattern[] {
    const trends: Pattern[] = [];

    temporalColumns.forEach(timeCol => {
      const numericColumns = allColumns.filter(col => col.type === 'numeric');

      numericColumns.forEach(numCol => {
        const trend = this.analyzeTrend(data, timeCol.name, numCol.name);
        if (trend.strength > 0.3) {
          trends.push({
            type: 'trend',
            description: `${trend.direction} trend in ${numCol.name} over ${timeCol.name}`,
            strength: trend.strength,
            columns: [timeCol.name, numCol.name]
          });
        }
      });
    });

    return trends;
  }

  private findDistributionPatterns(data: any[], categoricalColumns: any[]): Pattern[] {
    const patterns: Pattern[] = [];

    categoricalColumns.forEach(col => {
      const distribution = this.analyzeDistribution(data, col.name);

      if (distribution.skewness > 0.7) {
        patterns.push({
          type: 'distribution',
          description: `Highly skewed distribution in ${col.name} - most values concentrated in few categories`,
          strength: distribution.skewness,
          columns: [col.name]
        });
      }
    });

    return patterns;
  }

  private calculateCorrelation(data: any[], col1: string, col2: string): number {
    const values1 = data.map(row => parseFloat(row[col1])).filter(v => !isNaN(v));
    const values2 = data.map(row => parseFloat(row[col2])).filter(v => !isNaN(v));

    if (values1.length !== values2.length || values1.length === 0) return 0;

    const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
    const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;

    let numerator = 0;
    let sum1sq = 0;
    let sum2sq = 0;

    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      numerator += diff1 * diff2;
      sum1sq += diff1 * diff1;
      sum2sq += diff2 * diff2;
    }

    const denominator = Math.sqrt(sum1sq * sum2sq);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private analyzeTrend(data: any[], timeCol: string, valueCol: string): { direction: string; strength: number } {
    // Sort data by time
    const sortedData = data
      .filter(row => row[timeCol] && row[valueCol])
      .sort((a, b) => new Date(a[timeCol]).getTime() - new Date(b[timeCol]).getTime());

    if (sortedData.length < 3) return { direction: 'none', strength: 0 };

    const values = sortedData.map(row => parseFloat(row[valueCol])).filter(v => !isNaN(v));
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondMean - firstMean) / firstMean;
    const strength = Math.min(Math.abs(change), 1);

    return {
      direction: change > 0.1 ? 'Increasing' : change < -0.1 ? 'Decreasing' : 'Stable',
      strength
    };
  }

  private analyzeDistribution(data: any[], column: string): { skewness: number } {
    const values = data.map(row => row[column]).filter(v => v !== null && v !== undefined);
    const valueCounts = values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const counts = Object.values(valueCounts) as number[];
    const maxCount = Math.max(...counts);
    const totalCount = counts.reduce((a, b) => a + b, 0);

    const skewness = maxCount / totalCount;
    return { skewness };
  }
}