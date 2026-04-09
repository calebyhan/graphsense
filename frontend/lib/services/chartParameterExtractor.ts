import { ChartConfig, DatasetAttributes, ChartRecommendation } from '@/lib/types';

// Chart parameter requirements for each chart type
export const CHART_PARAMETER_REQUIREMENTS = {
  line: {
    required: ['xAxis', 'yAxis'],
    optional: ['color', 'size', 'timeField', 'timeFormat', 'groupBy'],
    supports: ['temporal', 'continuous', 'multi-series']
  },
  bar: {
    required: ['category', 'value'],
    optional: ['color', 'groupBy', 'facetRow', 'facetCol'],
    supports: ['categorical', 'comparison', 'grouped']
  },
  column: {
    required: ['category', 'value'],
    optional: ['color', 'groupBy', 'facetRow', 'facetCol'],
    supports: ['categorical', 'comparison', 'grouped']
  },
  scatter: {
    required: ['xAxis', 'yAxis'],
    optional: ['color', 'size', 'shape', 'opacity', 'groupBy'],
    supports: ['correlation', 'multi-dimensional', 'clustering']
  },
  pie: {
    required: ['category', 'value'],
    optional: ['color'],
    supports: ['proportional', 'part-to-whole']
  },
  histogram: {
    required: ['value'],
    optional: ['bins', 'bandwidth', 'color', 'facetRow', 'facetCol'],
    supports: ['distribution', 'frequency']
  },
  box_plot: {
    required: ['category', 'value'],
    optional: ['color', 'groupBy'],
    supports: ['statistical', 'distribution', 'outliers']
  },
  heatmap: {
    required: ['rowField', 'colField', 'valueField'],
    optional: ['color', 'opacity'],
    supports: ['matrix', 'correlation', 'density']
  },
  area: {
    required: ['xAxis', 'yAxis'],
    optional: ['color', 'groupBy', 'timeField', 'timeFormat'],
    supports: ['temporal', 'cumulative', 'stacked']
  },
  treemap: {
    required: ['hierarchyField', 'value'],
    optional: ['color', 'parentField'],
    supports: ['hierarchical', 'proportional']
  },
  sankey: {
    required: ['source', 'target', 'weight'],
    optional: ['color'],
    supports: ['flow', 'network', 'process']
  }
} as const;

export type ChartType = keyof typeof CHART_PARAMETER_REQUIREMENTS;

/**
 * Chart Parameter Extractor Service
 * 
 * This service extracts the appropriate chart parameters from a comprehensive
 * dataset attributes object based on the chart type and agentic recommendations.
 */
export class ChartParameterExtractor {
  
  /**
   * Extract chart configuration from dataset attributes and recommendation
   */
  static extractChartConfig(
    chartType: ChartType,
    datasetAttributes: DatasetAttributes,
    recommendation?: ChartRecommendation,
    title?: string
  ): ChartConfig {
    const requirements = CHART_PARAMETER_REQUIREMENTS[chartType];
    const config: ChartConfig = {
      title: title || this.generateTitle(chartType, datasetAttributes, recommendation),
      data: datasetAttributes.data,
      chartType,
    };

    // Extract required parameters
    requirements.required.forEach(param => {
      const value = this.extractParameter(param, datasetAttributes, recommendation);
      if (value) {
        (config as any)[param] = value;
      }
    });

    // Extract optional parameters that are available
    requirements.optional.forEach(param => {
      const value = this.extractParameter(param, datasetAttributes, recommendation);
      if (value) {
        (config as any)[param] = value;
      }
    });

    // Add chart-specific configurations
    config.chartSpecificConfig = this.getChartSpecificConfig(chartType, datasetAttributes, recommendation);

    return config;
  }

  /**
   * Map a frontend param name to the corresponding backend data_mapping field.
   * The backend sends snake_case axis hints inside data_mapping; this bridges them
   * to the camelCase param names used by ChartParameterExtractor.
   */
  private static resolveFromDataMapping(
    paramName: string,
    dataMapping: NonNullable<ChartRecommendation['data_mapping']>
  ): string | undefined {
    // Columns that map to the "x" position or primary category axis.
    const xAxisParams = new Set(['xAxis', 'category', 'colField', 'source', 'hierarchyField', 'timeField']);
    // Columns that map to the "y" position or numeric value axis.
    // Note: rowField is NOT here — it is a secondary category dimension carried via `color`.
    const yAxisParams = new Set(['yAxis', 'value', 'weight', 'valueField']);
    // Secondary categorical dimensions: backend encodes these in the `color` field so they
    // survive the round-trip without extending the DataMapping schema.
    // heatmap: color → rowField;  sankey: color → target.
    const colorAsSecondaryCategory = new Set(['rowField', 'target']);

    if (xAxisParams.has(paramName) && dataMapping.x_axis) return dataMapping.x_axis;
    if (yAxisParams.has(paramName) && dataMapping.y_axis) return dataMapping.y_axis;
    if (colorAsSecondaryCategory.has(paramName) && dataMapping.color) return dataMapping.color;
    if (paramName === 'color' && dataMapping.color) return dataMapping.color;
    if (paramName === 'size' && dataMapping.size) return dataMapping.size;
    return undefined;
  }

  /**
   * Extract a specific parameter from dataset attributes or recommendation
   */
  private static extractParameter(
    paramName: string,
    datasetAttributes: DatasetAttributes,
    recommendation?: ChartRecommendation
  ): any {
    // 1. Try backend data_mapping hints first (most authoritative — actual column names from AI)
    if (recommendation?.data_mapping) {
      const fromMapping = this.resolveFromDataMapping(paramName, recommendation.data_mapping);
      if (fromMapping) return fromMapping;
    }

    // 2. Try the recommendation config (client-side or already-processed values)
    if (recommendation?.config) {
      const value = (recommendation.config as any)[paramName];
      if (value) return value;
    }

    // 3. Try dataset attributes (client-side re-profiling result)
    const value = (datasetAttributes as any)[paramName];
    if (value) return value;

    // 4. Fall back to intelligent heuristic mapping
    return this.intelligentParameterMapping(paramName, datasetAttributes);
  }

  /**
   * Intelligent parameter mapping when direct mapping isn't available
   */
  private static intelligentParameterMapping(
    paramName: string,
    datasetAttributes: DatasetAttributes
  ): any {
    const { columns } = datasetAttributes;
    
    switch (paramName) {
      case 'xAxis':
        // Prefer temporal, then categorical, then first column
        return this.findColumnByType(['temporal', 'categorical'], columns) || columns[0]?.name;
      
      case 'yAxis':
      case 'value':
        // Prefer numeric columns
        return this.findColumnByType(['numeric'], columns);
      
      case 'category':
        // Prefer categorical columns
        return this.findColumnByType(['categorical'], columns);
      
      case 'color':
        // Find a good categorical column for coloring (not already used)
        const usedCols = [datasetAttributes.xAxis, datasetAttributes.yAxis, datasetAttributes.category];
        return this.findColumnByType(['categorical'], columns, usedCols);
      
      case 'size':
        // Find a numeric column for sizing (not already used)
        const usedNumericCols = [datasetAttributes.yAxis, datasetAttributes.value];
        return this.findColumnByType(['numeric'], columns, usedNumericCols);
      
      case 'rowField':
        // For heatmaps, find first categorical/text column, fallback to any column
        return this.findColumnByType(['categorical', 'text'], columns) || 
               (columns.length > 0 ? columns[0].name : undefined);
      
      case 'colField':
        // For heatmaps, find second categorical/text column
        const firstCat = this.findColumnByType(['categorical', 'text'], columns);
        const secondCat = this.findColumnByType(['categorical', 'text'], columns, [firstCat]);
        return secondCat || (columns.length > 1 ? columns[1].name : 
               columns.length > 0 ? columns[0].name : undefined);
      
      case 'valueField':
        // For heatmaps, find numeric column, fallback to any unused column
        const numericCol = this.findColumnByType(['numeric'], columns);
        if (numericCol) return numericCol;
        
        // Fallback to any column not used for row/col
        const reservedCols = [datasetAttributes.rowField, datasetAttributes.colField];
        const unusedCol = columns.find(col => !reservedCols.includes(col.name));
        return unusedCol?.name || (columns.length > 2 ? columns[2].name : 
               columns.length > 0 ? columns[0].name : undefined);
      
      case 'timeField':
        // Find temporal column
        return this.findColumnByType(['temporal'], columns);
      
      case 'source':
        // For sankey, find first suitable column
        return this.findColumnByType(['categorical', 'text'], columns);
      
      case 'target':
        // For sankey, find second suitable column
        const sourceCol = this.findColumnByType(['categorical', 'text'], columns);
        return this.findColumnByType(['categorical', 'text'], columns, [sourceCol]);
      
      case 'weight':
        // For sankey, find numeric column
        return this.findColumnByType(['numeric'], columns);
      
      case 'hierarchyField':
        // For treemap, find categorical column
        return this.findColumnByType(['categorical', 'text'], columns);
      
      case 'bins':
        // Default histogram bins based on data size
        return Math.min(30, Math.max(10, Math.ceil(Math.sqrt(datasetAttributes.data.length))));
      
      default:
        return undefined;
    }
  }

  /**
   * Find column by type preference
   */
  private static findColumnByType(
    types: string[], 
    columns: any[], 
    excludeColumns: (string | undefined)[] = []
  ): string | undefined {
    for (const type of types) {
      const column = columns.find(col => 
        col.type === type && !excludeColumns.includes(col.name)
      );
      if (column) return column.name;
    }
    return undefined;
  }

  /**
   * Generate intelligent title for the chart
   */
  private static generateTitle(
    chartType: ChartType,
    datasetAttributes: DatasetAttributes,
    recommendation?: ChartRecommendation
  ): string {
    // Use recommendation title if available
    if (recommendation?.config?.title && recommendation.config.title !== 'Untitled Chart') {
      return recommendation.config.title;
    }

    // Generate based on chart type and data.
    // Prefer data_mapping (actual backend-resolved column names) over datasetAttributes
    // defaults, which are computed before the recommendation's axis hints are applied.
    const xAxis = recommendation?.data_mapping?.x_axis || datasetAttributes.xAxis;
    const yAxis = recommendation?.data_mapping?.y_axis || datasetAttributes.yAxis;
    const category = recommendation?.data_mapping?.x_axis || datasetAttributes.category;
    const value = recommendation?.data_mapping?.y_axis || datasetAttributes.value;

    switch (chartType) {
      case 'line':
        return xAxis && yAxis ? `${yAxis} over ${xAxis}` : 'Line Chart';
      case 'bar':
      case 'column':
        return category && value ? `${value} by ${category}` : 'Bar Chart';
      case 'scatter':
        return xAxis && yAxis ? `${yAxis} vs ${xAxis}` : 'Scatter Plot';
      case 'pie':
        return category && value ? `${value} Distribution by ${category}` : 'Pie Chart';
      case 'histogram':
        return value ? `Distribution of ${value}` : 'Histogram';
      case 'box_plot':
        return category && value ? `${value} Distribution by ${category}` : 'Box Plot';
      case 'heatmap':
        return 'Correlation Heatmap';
      case 'area':
        return xAxis && yAxis ? `${yAxis} Area over ${xAxis}` : 'Area Chart';
      case 'treemap':
        return value ? `Hierarchical ${value}` : 'Treemap';
      case 'sankey':
        return 'Flow Diagram';
      default:
        return `${String(chartType).charAt(0).toUpperCase() + String(chartType).slice(1)} Chart`;
    }
  }

  /**
   * Get chart-specific configurations
   */
  private static getChartSpecificConfig(
    chartType: ChartType,
    _datasetAttributes: DatasetAttributes,
    _recommendation?: ChartRecommendation
  ): Record<string, any> {
    const config: Record<string, any> = {};

    switch (chartType) {
      case 'histogram':
        config.binMethod = 'equalWidth';
        config.showDensity = false;
        break;
      
      case 'heatmap':
        config.colorScheme = 'blues';
        config.showValues = true;
        break;
      
      case 'sankey':
        config.nodeWidth = 20;
        config.nodePadding = 10;
        break;
      
      case 'treemap':
        config.tiling = 'squarify';
        config.padding = 1;
        break;
      
      case 'scatter':
        config.showTrendline = false;
        config.pointSize = 4;
        break;
      
      default:
        break;
    }

    return config;
  }

  /**
   * Validate if a chart type is compatible with the available data
   */
  static validateChartCompatibility(
    chartType: ChartType,
    datasetAttributes: DatasetAttributes
  ): { compatible: boolean; missingParams: string[]; confidence: number } {
    const requirements = CHART_PARAMETER_REQUIREMENTS[chartType];
    const missingParams: string[] = [];
    
    requirements.required.forEach(param => {
      const value = this.extractParameter(param, datasetAttributes);
      if (!value) {
        missingParams.push(param);
      }
    });

    const compatible = missingParams.length === 0;
    const confidence = compatible ? 
      Math.max(0.7, 1 - (missingParams.length * 0.2)) : 
      Math.max(0.1, 0.6 - (missingParams.length * 0.15));

    return { compatible, missingParams, confidence };
  }

  /**
   * Get all compatible chart types for a dataset
   */
  static getCompatibleChartTypes(datasetAttributes: DatasetAttributes): {
    chartType: ChartType;
    compatibility: ReturnType<typeof ChartParameterExtractor.validateChartCompatibility>;
  }[] {
    const chartTypes = Object.keys(CHART_PARAMETER_REQUIREMENTS) as ChartType[];
    
    return chartTypes
      .map(chartType => ({
        chartType,
        compatibility: this.validateChartCompatibility(chartType, datasetAttributes)
      }))
      .filter(item => item.compatibility.compatible)
      .sort((a, b) => b.compatibility.confidence - a.compatibility.confidence);
  }
}
