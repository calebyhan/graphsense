import { ChartRecommendation, ChartConfig, DatasetAttributes } from '@/lib/types';
import { ChartParameterExtractor, ChartType } from './chartParameterExtractor';
import { DatasetAttributeBuilder } from './datasetAttributeBuilder';

/**
 * Recommendation Processor Service
 * 
 * This service processes recommendations from the agentic pipeline and converts them
 * into properly configured chart objects with all necessary parameters extracted
 * from the comprehensive dataset attributes.
 */
export class RecommendationProcessor {
  
  /**
   * Process recommendations from the agentic pipeline
   */
  static processRecommendations(
    agenticRecommendations: any[],
    rawData: any[],
    dataProfile?: any
  ): ChartRecommendation[] {
    if (!rawData || rawData.length === 0) return [];

    // Build comprehensive dataset attributes
    const datasetAttributes = DatasetAttributeBuilder.buildDatasetAttributes(rawData, dataProfile);

    return agenticRecommendations.map((rec, index) => {
      const chartType = this.normalizeChartType(rec.chart_type || rec.type || 'bar');
      
      // Extract chart configuration using the new parameter extraction system
      const config = ChartParameterExtractor.extractChartConfig(
        chartType,
        datasetAttributes,
        rec, // Pass the original recommendation for data mapping hints
        rec.title || rec.config?.title
      );

      // Extract reasoning text
      const justification = this.extractReasoningText(rec);

      return {
        chartType: chartType as any,
        confidence: this.normalizeConfidence(rec.confidence || rec.suitability_score || 0.8),
        justification,
        config
      };
    });
  }

  /**
   * Enhance a single recommendation with proper chart configuration
   */
  static enhanceRecommendation(
    recommendation: any,
    datasetAttributes: DatasetAttributes
  ): ChartRecommendation {
    const chartType = this.normalizeChartType(recommendation.chart_type || recommendation.type || 'bar');
    
    // Use the parameter extractor to get the optimal configuration
    const config = ChartParameterExtractor.extractChartConfig(
      chartType,
      datasetAttributes,
      recommendation
    );

    // Validate and adjust configuration based on compatibility
    const compatibility = ChartParameterExtractor.validateChartCompatibility(chartType, datasetAttributes);
    
    return {
      chartType: chartType as any,
      confidence: Math.min(
        this.normalizeConfidence(recommendation.confidence || 0.8),
        compatibility.confidence
      ),
      justification: this.extractReasoningText(recommendation),
      config: this.optimizeConfig(config, compatibility)
    };
  }

  /**
   * Get alternative chart recommendations based on data compatibility
   */
  static getAlternativeRecommendations(
    datasetAttributes: DatasetAttributes,
    excludeTypes: ChartType[] = []
  ): ChartRecommendation[] {
    const compatibleTypes = ChartParameterExtractor.getCompatibleChartTypes(datasetAttributes)
      .filter(item => !excludeTypes.includes(item.chartType))
      .slice(0, 3); // Top 3 alternatives

    return compatibleTypes.map(item => ({
      chartType: item.chartType as any,
      confidence: item.compatibility.confidence * 100,
      justification: this.generateJustification(item.chartType, datasetAttributes),
      config: ChartParameterExtractor.extractChartConfig(item.chartType, datasetAttributes)
    }));
  }

  /**
   * Normalize chart type from various formats
   */
  private static normalizeChartType(chartType: string): ChartType {
    const typeMap: Record<string, ChartType> = {
      'bar': 'bar',
      'column': 'bar',
      'line': 'line',
      'scatter': 'scatter',
      'scatterplot': 'scatter',
      'pie': 'pie',
      'histogram': 'histogram',
      'box': 'box_plot',
      'box_plot': 'box_plot',
      'boxplot': 'box_plot',
      'heatmap': 'heatmap',
      'area': 'area',
      'treemap': 'treemap',
      'sankey': 'sankey'
    };

    const normalized = chartType.toLowerCase().replace(/[^a-z]/g, '');
    return typeMap[normalized] || 'bar';
  }

  /**
   * Normalize confidence score to percentage
   */
  private static normalizeConfidence(confidence: number): number {
    if (confidence <= 1) {
      return Math.round(confidence * 100);
    }
    return Math.min(100, Math.max(0, Math.round(confidence)));
  }

  /**
   * Extract reasoning text from various recommendation formats
   */
  private static extractReasoningText(rec: any): string {
    // Try different reasoning field formats
    if (rec.reasoning) {
      if (typeof rec.reasoning === 'string') {
        return rec.reasoning;
      }
      if (Array.isArray(rec.reasoning) && rec.reasoning.length > 0) {
        const firstReasoning = rec.reasoning[0];
        if (typeof firstReasoning === 'string') {
          return firstReasoning;
        }
        if (typeof firstReasoning === 'object' && firstReasoning !== null) {
          return firstReasoning.reasoning || firstReasoning.text || 'AI-generated recommendation';
        }
      }
      if (typeof rec.reasoning === 'object' && rec.reasoning !== null) {
        return rec.reasoning.reasoning || rec.reasoning.text || 'AI-generated recommendation';
      }
    }

    // Try other fields
    if (rec.justification && typeof rec.justification === 'string') {
      return rec.justification;
    }

    if (rec.description && typeof rec.description === 'string') {
      return rec.description;
    }

    // Generate default reasoning based on chart type
    const chartType = this.normalizeChartType(rec.chart_type || rec.type || 'chart');
    return this.generateJustification(chartType, null);
  }

  /**
   * Generate justification text for a chart type
   */
  private static generateJustification(chartType: ChartType, datasetAttributes: DatasetAttributes | null): string {
    const justifications: Record<ChartType, string> = {
      'line': 'Perfect for showing trends and changes over time, making it easy to identify patterns and trajectories in your data.',
      'bar': 'Ideal for comparing values across different categories, providing clear visual comparison of quantities.',
      'column': 'Ideal for comparing values across different categories with vertical bars, providing clear visual comparison of quantities.',
      'scatter': 'Excellent for exploring relationships and correlations between two numeric variables, revealing patterns and outliers.',
      'pie': 'Great for showing proportional relationships and part-to-whole comparisons in categorical data.',
      'histogram': 'Perfect for understanding the distribution and frequency of values in your dataset.',
      'box_plot': 'Ideal for displaying statistical summaries and identifying outliers in your data distribution.',
      'heatmap': 'Excellent for visualizing patterns and correlations in matrix data with color-coded intensity.',
      'area': 'Great for showing cumulative values and trends over time with filled regions for emphasis.',
      'treemap': 'Perfect for displaying hierarchical data with nested rectangles proportional to values.',
      'sankey': 'Ideal for visualizing flow and relationships between different entities in your data.'
    };

    let base = justifications[chartType] || 'Suitable visualization for your data characteristics.';

    // Add data-specific context if available
    if (datasetAttributes) {
      const { columns } = datasetAttributes;
      const numericCount = columns.filter(col => col.type === 'numeric').length;
      const categoricalCount = columns.filter(col => col.type === 'categorical').length;
      const temporalCount = columns.filter(col => col.type === 'temporal').length;

      if (temporalCount > 0 && (chartType === 'line' || chartType === 'area')) {
        base += ` Your dataset contains temporal data, making this chart type particularly effective.`;
      } else if (categoricalCount > 0 && numericCount > 0 && (chartType === 'bar' || chartType === 'pie')) {
        base += ` With ${categoricalCount} categorical and ${numericCount} numeric columns, this visualization will clearly show your data relationships.`;
      } else if (numericCount >= 2 && chartType === 'scatter') {
        base += ` Your dataset has multiple numeric columns, perfect for correlation analysis.`;
      }
    }

    return base;
  }

  /**
   * Optimize chart configuration based on compatibility results
   */
  private static optimizeConfig(config: ChartConfig, compatibility: any): ChartConfig {
    const optimized = { ...config };

    // Special handling for heatmaps - ensure proper field mappings
    if (!config.rowField && !config.colField && config.data && config.data.length > 0) {
      const dataKeys = Object.keys(config.data[0]);
      
      // For heatmaps, try to find suitable row and column fields
      const categoricalFields = dataKeys.filter(key => {
        const sampleValues = config.data.slice(0, 10).map(row => row[key]);
        const uniqueValues = new Set(sampleValues).size;
        return uniqueValues < sampleValues.length * 0.8; // Less than 80% unique = categorical
      });

      const numericFields = dataKeys.filter(key => {
        const sampleValues = config.data.slice(0, 10).map(row => row[key]);
        return sampleValues.every(val => !isNaN(Number(val)) && val !== null && val !== '');
      });

      if (categoricalFields.length >= 2) {
        optimized.rowField = categoricalFields[0];
        optimized.colField = categoricalFields[1];
      } else if (categoricalFields.length >= 1) {
        optimized.rowField = categoricalFields[0];
        optimized.colField = dataKeys.find(key => key !== categoricalFields[0]) || dataKeys[1];
      } else {
        // Fallback to first two fields
        optimized.rowField = dataKeys[0];
        optimized.colField = dataKeys[1];
      }

      if (numericFields.length > 0) {
        optimized.valueField = numericFields[0];
      } else {
        // Fallback to a field that's not used for row/col
        optimized.valueField = dataKeys.find(key => 
          key !== optimized.rowField && key !== optimized.colField
        ) || dataKeys[2] || dataKeys[0];
      }
    }

    // If there are missing parameters, try to provide fallbacks
    if (compatibility.missingParams && compatibility.missingParams.length > 0) {
      compatibility.missingParams.forEach((param: string) => {
        switch (param) {
          case 'xAxis':
            if (config.data && config.data.length > 0) {
              const firstKey = Object.keys(config.data[0])[0];
              if (firstKey) optimized.xAxis = firstKey;
            }
            break;
          case 'yAxis':
          case 'value':
            if (config.data && config.data.length > 0) {
              const numericKey = Object.keys(config.data[0]).find(key => {
                const value = config.data[0][key];
                return !isNaN(Number(value)) && value !== null && value !== '';
              });
              if (numericKey) {
                optimized.yAxis = numericKey;
                optimized.value = numericKey;
              }
            }
            break;
          case 'category':
            if (config.data && config.data.length > 0) {
              const categoricalKey = Object.keys(config.data[0]).find(key => {
                const value = config.data[0][key];
                return isNaN(Number(value)) || value === null || value === '';
              });
              if (categoricalKey) optimized.category = categoricalKey;
            }
            break;
        }
      });
    }

    return optimized;
  }

  /**
   * Validate that a recommendation can be properly rendered
   */
  static validateRecommendation(recommendation: ChartRecommendation): {
    valid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if data is available
    if (!recommendation.config.data || recommendation.config.data.length === 0) {
      issues.push('No data available for visualization');
      return { valid: false, issues, suggestions };
    }

    // Check chart-specific requirements
    const chartType = recommendation.chartType as ChartType;
    const config = recommendation.config;

    switch (chartType) {
      case 'line':
      case 'bar':
      case 'area':
        if (!config.xAxis || !config.yAxis) {
          issues.push('Missing required X or Y axis configuration');
          suggestions.push('Ensure both X and Y axes are properly mapped to data columns');
        }
        break;

      case 'scatter':
        if (!config.xAxis || !config.yAxis) {
          issues.push('Missing required X or Y axis configuration');
        }
        // Check if both axes have numeric data for scatter plots
        if (config.xAxis && config.yAxis) {
          const xSample = config.data[0]?.[config.xAxis];
          const ySample = config.data[0]?.[config.yAxis];
          if (isNaN(Number(xSample)) || isNaN(Number(ySample))) {
            issues.push('Scatter plot requires numeric data for both axes');
            suggestions.push('Consider using a bar chart for categorical data');
          }
        }
        break;

      case 'pie':
        if (!config.category || !config.value) {
          issues.push('Missing required category or value configuration');
          suggestions.push('Ensure category and value fields are mapped to appropriate columns');
        }
        break;

      case 'histogram':
        if (!config.value && !config.yAxis) {
          issues.push('Missing required value configuration');
          suggestions.push('Map the value field to a numeric column');
        }
        break;

      case 'heatmap':
        if (!config.rowField || !config.colField || !config.valueField) {
          issues.push('Missing required row, column, or value field configuration');
          suggestions.push('Ensure row, column, and value fields are properly mapped');
        }
        break;

      case 'sankey':
        if (!config.source || !config.target || !config.weight) {
          issues.push('Missing required source, target, or weight configuration');
          suggestions.push('Map source, target, and weight fields to appropriate columns');
        }
        break;
    }

    const valid = issues.length === 0;
    return { valid, issues, suggestions };
  }
}
