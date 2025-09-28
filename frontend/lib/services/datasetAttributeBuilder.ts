import { DatasetAttributes, ColumnProfile, DataProfile } from '@/lib/types';

/**
 * Dataset Attribute Builder Service
 * 
 * This service builds a comprehensive DatasetAttributes object from raw data
 * by analyzing the data structure and inferring all possible chart attributes.
 */
export class DatasetAttributeBuilder {
  
  /**
   * Build comprehensive dataset attributes from raw data and profile
   */
  static buildDatasetAttributes(
    rawData: any[], 
    dataProfile?: DataProfile,
    filename?: string
  ): DatasetAttributes {
    const columns = dataProfile?.columns || this.inferColumnProfiles(rawData);
    const attributes: DatasetAttributes = {
      data: rawData,
      columns: columns,
    };

    // Analyze and populate all possible attributes
    this.populateBasicMappings(attributes, columns);
    this.populateAdvancedMappings(attributes, columns);
    this.populateFlowNetworkMappings(attributes, columns);
    this.populateHierarchicalMappings(attributes, columns);
    this.populateStatisticalMappings(attributes, columns, rawData);
    this.populateMultiDimensionalMappings(attributes, columns);
    this.populateTemporalMappings(attributes, columns);
    this.populateGeographicalMappings(attributes, columns);
    this.populateMatrixMappings(attributes, columns);
    this.populateCustomMappings(attributes, columns, rawData);

    return attributes;
  }

  /**
   * Infer column profiles from raw data if not provided
   */
  private static inferColumnProfiles(rawData: any[]): ColumnProfile[] {
    if (!rawData || rawData.length === 0) return [];

    const columns = Object.keys(rawData[0] || {});
    return columns.map(columnName => {
      const values = rawData.map(row => row[columnName]).filter(val => val != null);
      const type = this.inferColumnType(values);
      const uniqueValues = new Set(values).size;
      const nullCount = rawData.length - values.length;

      const profile: ColumnProfile = {
        name: columnName,
        type,
        uniqueValues,
        nullCount
      };

      // Add stats for numeric columns
      if (type === 'numeric') {
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

  /**
   * Infer column type from values
   */
  private static inferColumnType(values: any[]): 'numeric' | 'categorical' | 'temporal' | 'text' {
    if (values.length === 0) return 'text';

    // Check if numeric
    const numericCount = values.filter(val => {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num);
    }).length;

    if (numericCount / values.length > 0.8) {
      return 'numeric';
    }

    // Check if temporal
    const temporalCount = values.filter(val => {
      if (typeof val === 'string') {
        return !isNaN(Date.parse(val)) || /^\d{4}-\d{2}-\d{2}/.test(val);
      }
      return val instanceof Date;
    }).length;

    if (temporalCount / values.length > 0.7) {
      return 'temporal';
    }

    // Check if categorical (reasonable number of unique values)
    const uniqueValues = new Set(values).size;
    if (uniqueValues <= Math.min(20, values.length * 0.5)) {
      return 'categorical';
    }

    return 'text';
  }

  /**
   * Calculate standard deviation
   */
  private static calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Populate basic mappings (xAxis, yAxis, category, value)
   */
  private static populateBasicMappings(attributes: DatasetAttributes, columns: ColumnProfile[]) {
    const numericColumns = columns.filter(col => col.type === 'numeric');
    const categoricalColumns = columns.filter(col => col.type === 'categorical');
    const temporalColumns = columns.filter(col => col.type === 'temporal');

    // Set primary axes
    if (temporalColumns.length > 0) {
      attributes.xAxis = temporalColumns[0].name;
    } else if (categoricalColumns.length > 0) {
      attributes.xAxis = categoricalColumns[0].name;
    } else if (columns.length > 0) {
      attributes.xAxis = columns[0].name;
    }

    if (numericColumns.length > 0) {
      attributes.yAxis = numericColumns[0].name;
    }

    // Set category and value for categorical charts
    if (categoricalColumns.length > 0) {
      attributes.category = categoricalColumns[0].name;
    }

    if (numericColumns.length > 0) {
      attributes.value = numericColumns[0].name;
    }
  }

  /**
   * Populate advanced mappings (color, size, opacity, shape)
   */
  private static populateAdvancedMappings(attributes: DatasetAttributes, columns: ColumnProfile[]) {
    const numericColumns = columns.filter(col => col.type === 'numeric');
    const categoricalColumns = columns.filter(col => col.type === 'categorical');
    
    // Color mapping - prefer categorical, but can be numeric
    const unusedCategorical = categoricalColumns.filter(col => 
      col.name !== attributes.xAxis && col.name !== attributes.category
    );
    if (unusedCategorical.length > 0) {
      attributes.color = unusedCategorical[0].name;
    } else {
      const unusedNumeric = numericColumns.filter(col => 
        col.name !== attributes.yAxis && col.name !== attributes.value
      );
      if (unusedNumeric.length > 0) {
        attributes.color = unusedNumeric[0].name;
      }
    }

    // Size mapping - prefer numeric
    const sizeNumeric = numericColumns.filter(col => 
      col.name !== attributes.yAxis && 
      col.name !== attributes.value && 
      col.name !== attributes.color
    );
    if (sizeNumeric.length > 0) {
      attributes.size = sizeNumeric[0].name;
    }

    // Opacity mapping - can be numeric
    const opacityNumeric = numericColumns.filter(col => 
      col.name !== attributes.yAxis && 
      col.name !== attributes.value && 
      col.name !== attributes.color &&
      col.name !== attributes.size
    );
    if (opacityNumeric.length > 0) {
      attributes.opacity = opacityNumeric[0].name;
    }

    // Shape mapping - categorical only
    const shapeCategorical = categoricalColumns.filter(col => 
      col.name !== attributes.xAxis && 
      col.name !== attributes.category &&
      col.name !== attributes.color
    );
    if (shapeCategorical.length > 0) {
      attributes.shape = shapeCategorical[0].name;
    }
  }

  /**
   * Populate flow/network mappings (source, target, weight)
   */
  private static populateFlowNetworkMappings(attributes: DatasetAttributes, columns: ColumnProfile[]) {
    const categoricalColumns = columns.filter(col => col.type === 'categorical' || col.type === 'text');
    const numericColumns = columns.filter(col => col.type === 'numeric');

    if (categoricalColumns.length >= 2) {
      attributes.source = categoricalColumns[0].name;
      attributes.target = categoricalColumns[1].name;
    }

    if (numericColumns.length > 0) {
      attributes.weight = numericColumns[0].name;
    }
  }

  /**
   * Populate hierarchical mappings (hierarchyField, parentField, childrenField)
   */
  private static populateHierarchicalMappings(attributes: DatasetAttributes, columns: ColumnProfile[]) {
    const categoricalColumns = columns.filter(col => col.type === 'categorical' || col.type === 'text');

    // Look for hierarchical patterns in column names
    const hierarchyPatterns = ['category', 'group', 'type', 'class', 'level', 'parent', 'child'];
    
    for (const pattern of hierarchyPatterns) {
      const hierarchyColumn = categoricalColumns.find(col => 
        col.name.toLowerCase().includes(pattern)
      );
      if (hierarchyColumn) {
        attributes.hierarchyField = hierarchyColumn.name;
        break;
      }
    }

    // If no pattern match, use first categorical
    if (!attributes.hierarchyField && categoricalColumns.length > 0) {
      attributes.hierarchyField = categoricalColumns[0].name;
    }

    // Look for parent-child relationships
    const parentColumn = columns.find(col => 
      col.name.toLowerCase().includes('parent') || 
      col.name.toLowerCase().includes('parent_id')
    );
    if (parentColumn) {
      attributes.parentField = parentColumn.name;
    }
  }

  /**
   * Populate statistical mappings (bins, bandwidth)
   */
  private static populateStatisticalMappings(
    attributes: DatasetAttributes, 
    columns: ColumnProfile[], 
    rawData: any[]
  ) {
    // Default histogram bins based on data size
    const dataSize = rawData.length;
    attributes.bins = Math.min(50, Math.max(10, Math.ceil(Math.sqrt(dataSize))));

    // Bandwidth for density plots (using Scott's rule)
    const numericColumns = columns.filter(col => col.type === 'numeric');
    if (numericColumns.length > 0 && numericColumns[0].stats) {
      const std = numericColumns[0].stats.std;
      const n = dataSize;
      attributes.bandwidth = 1.06 * std * Math.pow(n, -0.2);
    }
  }

  /**
   * Populate multi-dimensional mappings (facetRow, facetCol, groupBy)
   */
  private static populateMultiDimensionalMappings(attributes: DatasetAttributes, columns: ColumnProfile[]) {
    const categoricalColumns = columns.filter(col => col.type === 'categorical');
    
    // Find good faceting columns (low cardinality)
    const facetCandidates = categoricalColumns.filter(col => 
      col.uniqueValues && col.uniqueValues <= 6 && col.uniqueValues >= 2
    );

    if (facetCandidates.length > 0) {
      attributes.facetRow = facetCandidates[0].name;
    }

    if (facetCandidates.length > 1) {
      attributes.facetCol = facetCandidates[1].name;
    }

    // GroupBy for multi-series charts
    const groupCandidates = categoricalColumns.filter(col =>
      col.name !== attributes.xAxis &&
      col.name !== attributes.category &&
      col.uniqueValues && col.uniqueValues <= 10
    );

    if (groupCandidates.length > 0) {
      attributes.groupBy = groupCandidates[0].name;
    }
  }

  /**
   * Populate temporal mappings (timeField, timeFormat, timeAggregation)
   */
  private static populateTemporalMappings(attributes: DatasetAttributes, columns: ColumnProfile[]) {
    const temporalColumns = columns.filter(col => col.type === 'temporal');

    if (temporalColumns.length > 0) {
      attributes.timeField = temporalColumns[0].name;
      
      // Infer time format from sample data
      const sampleValue = attributes.data.find(row => row[attributes.timeField!])?.[attributes.timeField!];
      if (sampleValue) {
        attributes.timeFormat = this.inferTimeFormat(sampleValue);
        attributes.timeAggregation = this.inferTimeAggregation(attributes.data, attributes.timeField);
      }
    }
  }

  /**
   * Infer time format from sample value
   */
  private static inferTimeFormat(sampleValue: any): string {
    const value = String(sampleValue);
    
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'ISO';
    } else if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return 'YYYY-MM-DD';
    } else if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) {
      return 'MM/DD/YYYY';
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value)) {
      return 'M/D/YYYY';
    }
    
    return 'auto';
  }

  /**
   * Infer appropriate time aggregation based on data density
   */
  private static inferTimeAggregation(data: any[], timeField: string): 'hour' | 'day' | 'week' | 'month' | 'year' {
    if (!timeField || data.length === 0) return 'day';

    const timeValues = data
      .map(row => row[timeField])
      .filter(val => val != null)
      .map(val => new Date(val))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (timeValues.length < 2) return 'day';

    const timeSpanMs = timeValues[timeValues.length - 1].getTime() - timeValues[0].getTime();
    const daySpan = timeSpanMs / (1000 * 60 * 60 * 24);

    if (daySpan <= 7) return 'hour';
    if (daySpan <= 90) return 'day';
    if (daySpan <= 730) return 'week';
    if (daySpan <= 2190) return 'month';
    return 'year';
  }

  /**
   * Populate geographical mappings (latitude, longitude, geoField)
   */
  private static populateGeographicalMappings(attributes: DatasetAttributes, columns: ColumnProfile[]) {
    // Look for latitude/longitude patterns
    const latPatterns = ['lat', 'latitude', 'y_coord'];
    const lngPatterns = ['lng', 'lon', 'longitude', 'x_coord'];

    for (const pattern of latPatterns) {
      const latColumn = columns.find(col => 
        col.name.toLowerCase().includes(pattern) && col.type === 'numeric'
      );
      if (latColumn) {
        attributes.latitude = latColumn.name;
        break;
      }
    }

    for (const pattern of lngPatterns) {
      const lngColumn = columns.find(col => 
        col.name.toLowerCase().includes(pattern) && col.type === 'numeric'
      );
      if (lngColumn) {
        attributes.longitude = lngColumn.name;
        break;
      }
    }

    // Look for geographical fields
    const geoPatterns = ['country', 'state', 'city', 'region', 'location', 'place'];
    for (const pattern of geoPatterns) {
      const geoColumn = columns.find(col => 
        col.name.toLowerCase().includes(pattern)
      );
      if (geoColumn) {
        attributes.geoField = geoColumn.name;
        break;
      }
    }
  }

  /**
   * Populate matrix/heatmap mappings (rowField, colField, valueField)
   */
  private static populateMatrixMappings(attributes: DatasetAttributes, columns: ColumnProfile[]) {
    const categoricalColumns = columns.filter(col => col.type === 'categorical' || col.type === 'text');
    const numericColumns = columns.filter(col => col.type === 'numeric');

    if (categoricalColumns.length >= 2) {
      attributes.rowField = categoricalColumns[0].name;
      attributes.colField = categoricalColumns[1].name;
    }

    if (numericColumns.length > 0) {
      attributes.valueField = numericColumns[0].name;
    }
  }

  /**
   * Populate custom mappings for specialized use cases
   */
  private static populateCustomMappings(
    attributes: DatasetAttributes, 
    columns: ColumnProfile[], 
    rawData: any[]
  ) {
    attributes.customAttributes = {};

    // Detect ID columns
    const idColumns = columns.filter(col => 
      col.name.toLowerCase().includes('id') || 
      (col.uniqueValues === rawData.length && col.uniqueValues > 1)
    );
    if (idColumns.length > 0) {
      attributes.customAttributes.idColumns = idColumns.map(col => col.name);
    }

    // Detect URL columns
    const urlColumns = columns.filter(col => {
      if (col.type !== 'text') return false;
      const sampleValue = rawData.find(row => row[col.name])?.[col.name];
      return sampleValue && typeof sampleValue === 'string' && 
             (sampleValue.startsWith('http') || sampleValue.startsWith('www'));
    });
    if (urlColumns.length > 0) {
      attributes.customAttributes.urlColumns = urlColumns.map(col => col.name);
    }

    // Detect percentage columns
    const percentageColumns = columns.filter(col => {
      if (col.type !== 'numeric' || !col.stats) return false;
      return col.stats.min >= 0 && col.stats.max <= 1;
    });
    if (percentageColumns.length > 0) {
      attributes.customAttributes.percentageColumns = percentageColumns.map(col => col.name);
    }

    // Detect currency columns
    const currencyColumns = columns.filter(col => {
      if (col.type !== 'numeric') return false;
      const sampleValue = rawData.find(row => row[col.name])?.[col.name];
      return col.name.toLowerCase().includes('price') || 
             col.name.toLowerCase().includes('cost') ||
             col.name.toLowerCase().includes('amount') ||
             (typeof sampleValue === 'string' && /[$€£¥]/.test(sampleValue));
    });
    if (currencyColumns.length > 0) {
      attributes.customAttributes.currencyColumns = currencyColumns.map(col => col.name);
    }
  }
}
