import { DataProfile, ColumnProfile } from '@/lib/types';

export class DataProfilerAgent {
  async analyze(data: any[]): Promise<DataProfile> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!data || data.length === 0) {
      throw new Error('No data provided for analysis');
    }

    const columns = this.analyzeColumns(data);
    const dataQuality = this.assessDataQuality(columns);

    return {
      columns,
      rowCount: data.length,
      dataQuality
    };
  }

  private analyzeColumns(data: any[]): ColumnProfile[] {
    const firstRow = data[0];
    const columnNames = Object.keys(firstRow);

    return columnNames.map(name => {
      const values = data.map(row => row[name]).filter(val => val !== null && val !== undefined && val !== '');
      const nullCount = data.length - values.length;

      const profile: ColumnProfile = {
        name,
        type: this.detectDataType(values),
        uniqueValues: new Set(values).size,
        nullCount
      };

      // Add statistics for numeric columns
      if (profile.type === 'numeric') {
        const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
        if (numericValues.length > 0) {
          profile.stats = {
            min: Math.min(...numericValues),
            max: Math.max(...numericValues),
            mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
            std: this.calculateStandardDeviation(numericValues)
          };
        }
      }

      return profile;
    });
  }

  private detectDataType(values: any[]): 'numeric' | 'categorical' | 'temporal' | 'text' {
    if (values.length === 0) return 'text';

    // Check for numeric values
    const numericCount = values.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
    if (numericCount / values.length > 0.8) {
      return 'numeric';
    }

    // Check for dates
    const dateCount = values.filter(v => {
      const date = new Date(v);
      return !isNaN(date.getTime()) && v.toString().match(/\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}/);
    }).length;
    if (dateCount / values.length > 0.5) {
      return 'temporal';
    }

    // Check if categorical (limited unique values relative to total)
    const uniqueValues = new Set(values).size;
    if (uniqueValues / values.length < 0.5 && uniqueValues < 20) {
      return 'categorical';
    }

    return 'text';
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private assessDataQuality(columns: ColumnProfile[]): 'high' | 'medium' | 'low' {
    const totalNullPercentage = columns.reduce((acc, col) => acc + col.nullCount, 0) /
                               (columns.length * (columns[0]?.nullCount !== undefined ?
                                columns.reduce((acc, col) => acc + col.nullCount, 0) / columns.length : 0));

    if (totalNullPercentage < 0.05) return 'high';
    if (totalNullPercentage < 0.2) return 'medium';
    return 'low';
  }
}