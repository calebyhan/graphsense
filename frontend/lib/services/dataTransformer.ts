/**
 * Data Transformation Service
 * Converts raw data into chart-ready format based on data mapping
 */

import { ChartConfig } from '@/lib/types';

export interface DataMapping {
  x_axis?: string;
  y_axis?: string;
  color?: string;
  size?: string;
  facet?: string;
  additional_dimensions?: Record<string, string>;
}

export interface ChartRecommendation {
  chartType: 'line' | 'bar' | 'scatter' | 'pie' | 'histogram' | 'box_plot' | 'heatmap' | 'area' | 'treemap' | 'sankey';
  confidence: number;
  justification: string;
  data_mapping?: DataMapping;
  config?: ChartConfig;
}

export class DataTransformer {
  /**
   * Transform raw data into chart-ready format based on recommendation
   */
  static transformDataForChart(
    rawData: any[],
    recommendation: ChartRecommendation
  ): ChartConfig {
    const { chartType, data_mapping } = recommendation;
    
    // Extract mapping fields
    const xAxis = data_mapping?.x_axis;
    const yAxis = data_mapping?.y_axis;
    
    console.log('DataTransformer: Transforming data', {
      chartType,
      dataMapping: data_mapping,
      rawDataLength: rawData?.length || 0,
      sampleRow: rawData?.[0],
      xAxis,
      yAxis
    });
    const color = data_mapping?.color;
    const size = data_mapping?.size;
    const facet = data_mapping?.facet;

    // Generate chart title
    const title = this.generateChartTitle(chartType, xAxis, yAxis);

    // Transform data based on chart type
    let transformedData: any[] = [];
    
    switch (chartType) {
      case 'line':
      case 'bar':
      case 'area':
        transformedData = this.transformForLineBarArea(rawData, xAxis, yAxis);
        break;
        
      case 'scatter':
        transformedData = this.transformForScatter(rawData, xAxis, yAxis);
        break;
        
      case 'pie':
        transformedData = this.transformForPie(rawData, xAxis, yAxis);
        break;
        
      case 'histogram':
        transformedData = this.transformForHistogram(rawData, yAxis);
        break;
        
      case 'box_plot':
        transformedData = this.transformForBoxPlot(rawData, yAxis);
        break;
        
      case 'heatmap':
        transformedData = this.transformForHeatmap(rawData, xAxis, yAxis, color);
        break;
        
      case 'treemap':
        transformedData = this.transformForTreemap(rawData, xAxis, yAxis);
        break;
        
      case 'sankey':
        transformedData = this.transformForSankey(rawData, xAxis, yAxis);
        break;
        
      default:
        // Fallback: return raw data with basic structure
        console.log('Unknown chart type, using fallback:', chartType);
        transformedData = rawData.slice(0, 100);
    }

    const result = {
      title,
      data: transformedData,
      xAxis,
      yAxis,
      category: xAxis,
      value: yAxis,
      color,
      size,
      bins: chartType === 'histogram' ? 20 : undefined,
    };

    console.log('DataTransformer: Transformation complete', {
      title,
      dataLength: transformedData.length,
      xAxis,
      yAxis,
      sampleData: transformedData.slice(0, 3)
    });

    return result;
  }

  /**
   * Transform data for line, bar, and area charts
   */
  private static transformForLineBarArea(
    rawData: any[],
    xAxis?: string,
    yAxis?: string
  ): any[] {
    if (!xAxis || !yAxis) {
      return rawData.slice(0, 100);
    }

    return rawData
      .filter(row => 
        row[xAxis] != null && 
        row[yAxis] != null &&
        !isNaN(parseFloat(row[yAxis]))
      )
      .map(row => ({
        [xAxis]: row[xAxis],
        [yAxis]: parseFloat(row[yAxis]) || 0,
        x: row[xAxis],
        y: parseFloat(row[yAxis]) || 0,
      }))
      .slice(0, 100); // Limit for performance
  }

  /**
   * Transform data for scatter plots
   */
  private static transformForScatter(
    rawData: any[],
    xAxis?: string,
    yAxis?: string
  ): any[] {
    if (!xAxis || !yAxis) {
      return rawData.slice(0, 100);
    }

    return rawData
      .filter(row => 
        row[xAxis] != null && 
        row[yAxis] != null &&
        !isNaN(parseFloat(row[xAxis])) &&
        !isNaN(parseFloat(row[yAxis]))
      )
      .map(row => ({
        [xAxis]: parseFloat(row[xAxis]),
        [yAxis]: parseFloat(row[yAxis]),
        x: parseFloat(row[xAxis]),
        y: parseFloat(row[yAxis]),
      }))
      .slice(0, 100);
  }

  /**
   * Transform data for pie charts
   */
  private static transformForPie(
    rawData: any[],
    category?: string,
    value?: string
  ): any[] {
    if (!category || !value) {
      return rawData.slice(0, 10);
    }

    // Aggregate data by category
    const aggregated = rawData.reduce((acc, row) => {
      const cat = row[category];
      const val = parseFloat(row[value]) || 0;
      if (cat != null && !isNaN(val)) {
        acc[cat] = (acc[cat] || 0) + val;
      }
      return acc;
    }, {} as Record<string, number>);

    return (Object.entries(aggregated) as [string, number][])
      .map(([name, value]) => ({
        name,
        value,
        [category]: name,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Limit to 10 slices
  }

  /**
   * Transform data for histograms
   */
  private static transformForHistogram(
    rawData: any[],
    yAxis?: string
  ): any[] {
    if (!yAxis) {
      return rawData.slice(0, 100);
    }

    return rawData
      .filter(row => 
        row[yAxis] != null &&
        !isNaN(parseFloat(row[yAxis]))
      )
      .map(row => ({
        value: parseFloat(row[yAxis]),
        [yAxis]: parseFloat(row[yAxis]),
      }));
  }

  /**
   * Transform data for box plots
   */
  private static transformForBoxPlot(
    rawData: any[],
    yAxis?: string
  ): any[] {
    if (!yAxis) {
      return rawData.slice(0, 100);
    }

    return rawData
      .filter(row => 
        row[yAxis] != null &&
        !isNaN(parseFloat(row[yAxis]))
      )
      .map(row => ({
        value: parseFloat(row[yAxis]),
        [yAxis]: parseFloat(row[yAxis]),
      }));
  }

  /**
   * Transform data for heatmaps
   */
  private static transformForHeatmap(
    rawData: any[],
    xAxis?: string,
    yAxis?: string,
    value?: string
  ): any[] {
    if (!xAxis || !yAxis) {
      return rawData.slice(0, 100);
    }

    const valueField = value || yAxis;
    
    return rawData
      .filter(row => 
        row[xAxis] != null && 
        row[yAxis] != null &&
        row[valueField] != null &&
        !isNaN(parseFloat(row[valueField]))
      )
      .map(row => ({
        [xAxis]: row[xAxis],
        [yAxis]: row[yAxis],
        value: parseFloat(row[valueField]),
        [valueField]: parseFloat(row[valueField]),
      }));
  }

  /**
   * Transform data for treemaps
   */
  private static transformForTreemap(
    rawData: any[],
    category?: string,
    value?: string
  ): any[] {
    if (!category || !value) {
      return rawData.slice(0, 20);
    }

    // Aggregate data by category
    const aggregated = rawData.reduce((acc, row) => {
      const cat = row[category];
      const val = parseFloat(row[value]) || 0;
      if (cat != null && !isNaN(val)) {
        acc[cat] = (acc[cat] || 0) + val;
      }
      return acc;
    }, {} as Record<string, number>);

    return (Object.entries(aggregated) as [string, number][])
      .map(([name, value]) => ({
        name,
        value,
        size: value,
        [category]: name,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }

  /**
   * Transform data for Sankey diagrams
   */
  private static transformForSankey(
    rawData: any[],
    source?: string,
    target?: string
  ): any[] {
    if (!source || !target) {
      return rawData.slice(0, 50);
    }

    return rawData
      .filter(row => 
        row[source] != null && 
        row[target] != null
      )
      .map(row => ({
        source: row[source],
        target: row[target],
        value: 1, // Default value for Sankey
      }))
      .slice(0, 50);
  }

  /**
   * Generate chart title based on chart type and axes
   */
  private static generateChartTitle(
    chartType: string,
    xAxis?: string,
    yAxis?: string
  ): string {
    const chartTypeLabel = chartType.charAt(0).toUpperCase() + chartType.slice(1).replace('_', ' ');
    
    if (xAxis && yAxis) {
      return `${yAxis} vs ${xAxis}`;
    } else if (xAxis) {
      return `Distribution of ${xAxis}`;
    } else if (yAxis) {
      return `${chartTypeLabel} of ${yAxis}`;
    }
    
    return `${chartTypeLabel} Visualization`;
  }

  /**
   * Validate that required fields exist in the data
   */
  static validateDataMapping(
    rawData: any[],
    dataMapping: DataMapping
  ): { isValid: boolean; missingFields: string[] } {
    if (!rawData || rawData.length === 0) {
      return { isValid: false, missingFields: ['data'] };
    }

    const missingFields: string[] = [];
    const sampleRow = rawData[0];

    if (dataMapping.x_axis && !(dataMapping.x_axis in sampleRow)) {
      missingFields.push(dataMapping.x_axis);
    }
    if (dataMapping.y_axis && !(dataMapping.y_axis in sampleRow)) {
      missingFields.push(dataMapping.y_axis);
    }
    if (dataMapping.color && !(dataMapping.color in sampleRow)) {
      missingFields.push(dataMapping.color);
    }
    if (dataMapping.size && !(dataMapping.size in sampleRow)) {
      missingFields.push(dataMapping.size);
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }
}
