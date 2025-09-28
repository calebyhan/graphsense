/**
 * Smart Recommendation Service
 * Provides intelligent chart recommendations with better labeling and calculations
 */

import { ChartRecommendation } from '@/lib/types';

export interface DataProfile {
  columns: Array<{
    name: string;
    type: 'numeric' | 'categorical' | 'temporal' | 'text';
    stats?: {
      min: number;
      max: number;
      mean: number;
      std: number;
    };
    uniqueValues?: number;
    nullCount: number;
  }>;
  rowCount: number;
  dataQuality: 'high' | 'medium' | 'low';
}

export interface SmartRecommendation extends ChartRecommendation {
  suitabilityScore: number;
  reasoning: string;
  dataInsights: string[];
  bestFor: string[];
  limitations: string[];
}

export class SmartRecommendationService {
  /**
   * Generate smart recommendations with detailed analysis
   */
  static generateSmartRecommendations(
    recommendations: ChartRecommendation[],
    dataProfile: DataProfile,
    rawData: any[]
  ): SmartRecommendation[] {
    return recommendations.map(rec => {
      const analysis = this.analyzeRecommendation(rec, dataProfile, rawData);
      
      return {
        ...rec,
        type: rec.chartType, // Map chartType to type for compatibility
        suitabilityScore: analysis.suitabilityScore,
        reasoning: analysis.reasoning,
        dataInsights: analysis.dataInsights,
        bestFor: analysis.bestFor,
        limitations: analysis.limitations
      };
    }).sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  }

  /**
   * Analyze a single recommendation for suitability
   */
  private static analyzeRecommendation(
    recommendation: ChartRecommendation,
    dataProfile: DataProfile,
    rawData: any[]
  ): {
    suitabilityScore: number;
    reasoning: string;
    dataInsights: string[];
    bestFor: string[];
    limitations: string[];
  } {
    const { chartType, config } = recommendation;
    const insights: string[] = [];
    const bestFor: string[] = [];
    const limitations: string[] = [];
    let suitabilityScore = 0.5; // Base score

    // Analyze data characteristics
    const numericColumns = dataProfile.columns.filter(col => col.type === 'numeric');
    const categoricalColumns = dataProfile.columns.filter(col => col.type === 'categorical');
    const temporalColumns = dataProfile.columns.filter(col => col.type === 'temporal');

    // Chart-specific analysis
    switch (chartType) {
      case 'bar':
        if (categoricalColumns.length > 0 && numericColumns.length > 0) {
          suitabilityScore = 0.9;
          insights.push(`Perfect for comparing ${numericColumns.length} numeric values across ${categoricalColumns.length} categories`);
          bestFor.push('Comparing categories', 'Showing rankings', 'Displaying counts');
        } else if (categoricalColumns.length > 0) {
          suitabilityScore = 0.7;
          insights.push('Good for showing category distributions');
          bestFor.push('Category analysis', 'Distribution visualization');
        } else {
          suitabilityScore = 0.3;
          limitations.push('Requires categorical data for optimal results');
        }
        break;

      case 'line':
        if (temporalColumns.length > 0 && numericColumns.length > 0) {
          suitabilityScore = 0.95;
          insights.push(`Excellent for showing trends over time with ${temporalColumns.length} time dimension(s)`);
          bestFor.push('Time series analysis', 'Trend visualization', 'Temporal patterns');
        } else if (numericColumns.length >= 2) {
          suitabilityScore = 0.8;
          insights.push('Good for showing relationships between numeric variables');
          bestFor.push('Numeric relationships', 'Correlation analysis');
        } else {
          suitabilityScore = 0.4;
          limitations.push('Works best with time series or multiple numeric variables');
        }
        break;

      case 'scatter':
        if (numericColumns.length >= 2) {
          suitabilityScore = 0.9;
          insights.push(`Ideal for exploring relationships between ${numericColumns.length} numeric variables`);
          bestFor.push('Correlation analysis', 'Pattern discovery', 'Outlier detection');
        } else {
          suitabilityScore = 0.2;
          limitations.push('Requires at least 2 numeric columns');
        }
        break;

      case 'pie':
        if (categoricalColumns.length > 0) {
          suitabilityScore = 0.8;
          insights.push(`Great for showing proportions of ${categoricalColumns.length} categories`);
          bestFor.push('Proportion analysis', 'Category breakdown', 'Part-to-whole relationships');
          if (categoricalColumns.length > 8) {
            limitations.push('May become cluttered with many categories');
          }
        } else {
          suitabilityScore = 0.3;
          limitations.push('Requires categorical data');
        }
        break;

      case 'histogram':
        if (numericColumns.length > 0) {
          suitabilityScore = 0.85;
          insights.push(`Perfect for showing distribution of ${numericColumns.length} numeric variables`);
          bestFor.push('Distribution analysis', 'Data shape exploration', 'Statistical insights');
        } else {
          suitabilityScore = 0.2;
          limitations.push('Requires numeric data');
        }
        break;

      case 'heatmap':
        if (numericColumns.length >= 2 && categoricalColumns.length >= 2) {
          suitabilityScore = 0.9;
          insights.push('Excellent for showing relationships between multiple categorical and numeric variables');
          bestFor.push('Multi-dimensional analysis', 'Pattern recognition', 'Correlation matrices');
        } else if (numericColumns.length >= 2) {
          suitabilityScore = 0.7;
          insights.push('Good for numeric correlation analysis');
          bestFor.push('Numeric correlations');
        } else {
          suitabilityScore = 0.3;
          limitations.push('Works best with multiple numeric and categorical variables');
        }
        break;

      default:
        suitabilityScore = 0.5;
        insights.push('Standard visualization approach');
        bestFor.push('General data visualization');
    }

    // Data quality adjustments
    if (dataProfile.dataQuality === 'high') {
      suitabilityScore += 0.1;
      insights.push('High-quality data enhances visualization accuracy');
    } else if (dataProfile.dataQuality === 'low') {
      suitabilityScore -= 0.1;
      limitations.push('Data quality issues may affect visualization clarity');
    }

    // Sample size considerations
    if (dataProfile.rowCount > 1000) {
      insights.push(`Large dataset (${dataProfile.rowCount} rows) - consider sampling for performance`);
    } else if (dataProfile.rowCount < 10) {
      limitations.push('Small dataset may not show meaningful patterns');
      suitabilityScore -= 0.2;
    }

    // Generate reasoning
    const reasoning = this.generateReasoning(chartType, insights, bestFor, limitations);

    return {
      suitabilityScore: Math.max(0, Math.min(1, suitabilityScore)),
      reasoning,
      dataInsights: insights,
      bestFor,
      limitations
    };
  }

  /**
   * Generate human-readable reasoning
   */
  private static generateReasoning(
    chartType: string,
    insights: string[],
    bestFor: string[],
    limitations: string[]
  ): string {
    const chartTypeLabel = chartType.charAt(0).toUpperCase() + chartType.slice(1);
    
    let reasoning = `${chartTypeLabel} chart is `;
    
    if (insights.length > 0) {
      reasoning += insights[0].toLowerCase();
    }
    
    if (bestFor.length > 0) {
      reasoning += `. Best for: ${bestFor.slice(0, 2).join(', ')}`;
    }
    
    if (limitations.length > 0) {
      reasoning += `. Note: ${limitations[0]}`;
    }
    
    return reasoning;
  }

  /**
   * Calculate data complexity score
   */
  static calculateDataComplexity(dataProfile: DataProfile): {
    score: number;
    level: 'simple' | 'moderate' | 'complex';
    description: string;
  } {
    const numericCount = dataProfile.columns.filter(col => col.type === 'numeric').length;
    const categoricalCount = dataProfile.columns.filter(col => col.type === 'categorical').length;
    const temporalCount = dataProfile.columns.filter(col => col.type === 'temporal').length;
    
    let score = 0;
    score += numericCount * 0.3;
    score += categoricalCount * 0.2;
    score += temporalCount * 0.4;
    score += Math.log(dataProfile.rowCount) * 0.1;
    
    if (score < 1) {
      return { score, level: 'simple', description: 'Simple dataset with basic structure' };
    } else if (score < 2) {
      return { score, level: 'moderate', description: 'Moderate complexity with multiple data types' };
    } else {
      return { score, level: 'complex', description: 'Complex dataset requiring advanced analysis' };
    }
  }

  /**
   * Get recommendation confidence based on data fit
   */
  static calculateConfidence(
    recommendation: ChartRecommendation,
    dataProfile: DataProfile
  ): number {
    const { chartType } = recommendation;
    const numericCount = dataProfile.columns.filter(col => col.type === 'numeric').length;
    const categoricalCount = dataProfile.columns.filter(col => col.type === 'categorical').length;
    const temporalCount = dataProfile.columns.filter(col => col.type === 'temporal').length;
    
    let confidence = 0.5;
    
    switch (chartType) {
      case 'bar':
        confidence = categoricalCount > 0 ? 0.8 : 0.3;
        break;
      case 'line':
        confidence = temporalCount > 0 ? 0.9 : (numericCount >= 2 ? 0.7 : 0.4);
        break;
      case 'scatter':
        confidence = numericCount >= 2 ? 0.9 : 0.2;
        break;
      case 'pie':
        confidence = categoricalCount > 0 ? 0.8 : 0.3;
        break;
      case 'histogram':
        confidence = numericCount > 0 ? 0.85 : 0.2;
        break;
      case 'heatmap':
        confidence = (numericCount >= 2 && categoricalCount >= 2) ? 0.9 : 0.4;
        break;
      default:
        confidence = 0.5;
    }
    
    return Math.round(confidence * 100);
  }
}
