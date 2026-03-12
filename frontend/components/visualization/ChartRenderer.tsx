'use client';

import { ChartConfig } from '@/lib/types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Treemap,
} from 'recharts';
import { useEffect, useRef, useMemo, useCallback, memo } from 'react';
import * as d3 from 'd3';
import { useChartPerformance } from '@/hooks/usePerformance';
import { PerformanceIndicator } from '@/components/common/PerformanceIndicator';

type ChartType = 'line' | 'bar' | 'scatter' | 'pie' | 'histogram' | 'box_plot' | 'heatmap' | 'area' | 'treemap' | 'sankey';

interface ChartRendererProps {
  config: ChartConfig;
  chartType: ChartType;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
];

// Performance optimization constants
const MAX_POINTS_LINE = 2000;
const SAMPLE_SIZE_DETECTION = 100; // For field type detection

// Intelligent data sampling function
const sampleData = (data: any[], maxPoints: number, chartType: string) => {
  if (!data || data.length <= maxPoints) return data;
  
  console.log(`🎯 Sampling ${data.length} points down to ${maxPoints} for ${chartType} chart`);
  
  // For time-series data, prefer systematic sampling
  if (chartType === 'line' || chartType === 'area') {
    const step = Math.floor(data.length / maxPoints);
    return data.filter((_, index) => index % step === 0).slice(0, maxPoints);
  }
  
  // For other charts, use random sampling
  const indices = new Set<number>();
  while (indices.size < maxPoints) {
    indices.add(Math.floor(Math.random() * data.length));
  }
  return Array.from(indices).sort((a, b) => a - b).map(i => data[i]);
};

// Memoized field detection
const detectFieldTypes = (data: any[], sampleSize: number = SAMPLE_SIZE_DETECTION) => {
  if (!data || data.length === 0) return { numeric: [], categorical: [] };
  
  const sample = data.slice(0, Math.min(sampleSize, data.length));
  const keys = Object.keys(sample[0] || {});
  
  const numeric = keys.filter(key => {
    const values = sample.map(row => row[key]);
    const numericValues = values.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
    return numericValues.length > values.length * 0.7;
  });
  
  const categorical = keys.filter(key => !numeric.includes(key));
  
  return { numeric, categorical };
};

// D3.js Chart Components
const D3Histogram = memo(({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Memoize data processing for performance
  const processedData = useMemo(() => {
    if (!config.data || config.data.length === 0) return null;
    
    // Sample data for large datasets
    const sampledData = sampleData(config.data, MAX_POINTS_LINE, 'histogram');
    
    // Auto-detect numeric field for histogram
    let valueField = config.value || config.yAxis || config.xAxis || config.chartSpecificConfig?.value;
    
    if (!valueField) {
      const { numeric } = detectFieldTypes(sampledData);
      valueField = numeric[0];
      console.log('📊 Histogram auto-detected field:', valueField);
    }
    
    if (!valueField) return null;
    
    const numericData = sampledData.map(d => +d[valueField!]).filter(d => !isNaN(d));
    
    return {
      data: numericData,
      valueField,
      originalLength: config.data.length,
      sampledLength: sampledData.length
    };
  }, [config.data, config.value, config.yAxis, config.xAxis, config.chartSpecificConfig?.value]);

  useEffect(() => {
    if (!svgRef.current || !processedData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const { data: numericData } = processedData;
    
    if (numericData.length === 0) {
      svg.append("text")
        .attr("x", 300)
        .attr("y", 150)
        .attr("text-anchor", "middle")
        .text("No valid numeric data for histogram");
      return;
    }

    const bins = config.bins || Math.min(30, Math.max(10, Math.ceil(Math.sqrt(numericData.length))));

    const x = d3.scaleLinear()
      .domain(d3.extent(numericData) as [number, number])
      .range([0, width]);

    const histogram = d3.histogram()
      .value(d => d)
      .domain(x.domain() as [number, number])
      .thresholds(bins);

    const binData = histogram(numericData);

    const y = d3.scaleLinear()
      .domain([0, d3.max(binData, d => d.length)!])
      .range([height, 0]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const colorScale = config.color ?
      d3.scaleOrdinal(COLORS) :
      () => COLORS[4];

    g.selectAll("rect")
      .data(binData)
      .enter().append("rect")
      .attr("x", d => x(d.x0!))
      .attr("y", d => y(d.length))
      .attr("width", d => Math.max(0, x(d.x1!) - x(d.x0!) - 1))
      .attr("height", d => height - y(d.length))
      .attr("fill", (d, i) => colorScale(String(i)))
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .append("title")
      .text(d => `Range: ${d.x0?.toFixed(2)} - ${d.x1?.toFixed(2)}\nCount: ${d.length}`);

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format(".2f")))
      .append("text")
      .attr("x", width / 2)
      .attr("y", 35)
      .attr("text-anchor", "middle")
      .attr("fill", "black")
      .text(processedData.valueField);

    g.append("g")
      .call(d3.axisLeft(y))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -35)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "black")
      .text("Frequency");

    // Add statistics overlay if requested
    if (config.chartSpecificConfig?.showStats) {
      const mean = d3.mean(numericData)!;
      const std = d3.deviation(numericData)!;

      // Mean line
      g.append("line")
        .attr("x1", x(mean))
        .attr("x2", x(mean))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");

      // Standard deviation area
      g.append("rect")
        .attr("x", x(mean - std))
        .attr("y", 0)
        .attr("width", x(mean + std) - x(mean - std))
        .attr("height", height)
        .attr("fill", "red")
        .attr("opacity", 0.1);

      // Legend
      const legend = g.append("g")
        .attr("transform", `translate(${width - 100}, 20)`);

      legend.append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");

      legend.append("text")
        .attr("x", 25)
        .attr("y", 5)
        .attr("font-size", "12px")
        .text(`Mean: ${mean.toFixed(2)}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedData]);

  if (!processedData) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">No valid numeric data for histogram</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <svg ref={svgRef} width={600} height={300} />
      {processedData.originalLength > processedData.sampledLength && (
        <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
          Showing {processedData.sampledLength.toLocaleString()} of {processedData.originalLength.toLocaleString()} points
        </div>
      )}
    </div>
  );
});

const D3BoxPlot = ({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !config.data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    let yAxisField = config.yAxis;
    if (!yAxisField && config.data && config.data.length > 0) {
      const dataKeys = Object.keys(config.data[0]);
      yAxisField = dataKeys.find(key => {
        const sampleValues = config.data.slice(0, 10).map(row => row[key]);
        const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
        return numericValues.length > sampleValues.length * 0.7;
      });
    }

    if (!yAxisField) {
      return;
    }

    const data = config.data.map(d => +d[yAxisField!]).sort(d3.ascending);

    const q1 = d3.quantile(data, 0.25)!;
    const median = d3.quantile(data, 0.5)!;
    const q3 = d3.quantile(data, 0.75)!;
    const iqr = q3 - q1;
    const min = Math.max(d3.min(data)!, q1 - 1.5 * iqr);
    const max = Math.min(d3.max(data)!, q3 + 1.5 * iqr);

    const y = d3.scaleLinear()
      .domain([min, max])
      .range([height, 0]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const center = width / 2;
    const boxWidth = 60;

    g.append("rect")
      .attr("x", center - boxWidth / 2)
      .attr("y", y(q3))
      .attr("width", boxWidth)
      .attr("height", y(q1) - y(q3))
      .attr("fill", COLORS[5])
      .attr("opacity", 0.7);

    g.append("line")
      .attr("x1", center - boxWidth / 2)
      .attr("x2", center + boxWidth / 2)
      .attr("y1", y(median))
      .attr("y2", y(median))
      .attr("stroke", "black")
      .attr("stroke-width", 2);

    g.append("line")
      .attr("x1", center)
      .attr("x2", center)
      .attr("y1", y(min))
      .attr("y2", y(q1))
      .attr("stroke", "black");

    g.append("line")
      .attr("x1", center)
      .attr("x2", center)
      .attr("y1", y(max))
      .attr("y2", y(q3))
      .attr("stroke", "black");

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(d3.scaleBand().domain([yAxisField!]).range([center - 50, center + 50])));

    g.append("g")
      .call(d3.axisLeft(y));
  }, [config]);

  return <svg ref={svgRef} width={600} height={300} />;
};

const D3Heatmap = ({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !config.data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 50, right: 80, bottom: 50, left: 80 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    let xField = config.rowField || config.xAxis;
    let yField = config.colField || config.yAxis;
    let valueField = config.valueField || config.value;

    if ((!xField || !yField || !valueField) && config.data && config.data.length > 0) {
      const dataKeys = Object.keys(config.data[0]);

      if (!xField) {
        xField = dataKeys.find(key => {
          const sampleValues = config.data.slice(0, 10).map(row => row[key]);
          const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
          return numericValues.length < sampleValues.length * 0.5;
        }) || dataKeys[0];
      }

      if (!yField) {
        yField = dataKeys.find(key => {
          if (key === xField) return false;
          const sampleValues = config.data.slice(0, 10).map(row => row[key]);
          const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
          return numericValues.length < sampleValues.length * 0.5;
        }) || dataKeys[1] || dataKeys[0];
      }

      if (!valueField) {
        valueField = dataKeys.find(key => {
          if (key === xField || key === yField) return false;
          const sampleValues = config.data.slice(0, 10).map(row => row[key]);
          const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
          return numericValues.length > sampleValues.length * 0.7;
        }) || dataKeys.find(key => key !== xField && key !== yField) || dataKeys[2] || dataKeys[1];
      }
    }

    if (!xField || !yField || !valueField) {
      svg.append("text")
        .attr("x", 300)
        .attr("y", 150)
        .attr("text-anchor", "middle")
        .text("Heatmap requires row, column, and value fields");
      return;
    }

    const xValues = [...new Set(config.data.map(d => String(d[xField])))].sort();
    const yValues = [...new Set(config.data.map(d => String(d[yField])))].sort();

    const x = d3.scaleBand()
      .domain(xValues)
      .range([0, width])
      .padding(0.05);

    const y = d3.scaleBand()
      .domain(yValues)
      .range([0, height])
      .padding(0.05);

    const dataMap = new Map();
    config.data.forEach(d => {
      const key = `${d[xField]}-${d[yField]}`;
      dataMap.set(key, +d[valueField] || 0);
    });

    const values = Array.from(dataMap.values());
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain(d3.extent(values) as [number, number]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    xValues.forEach(xVal => {
      yValues.forEach(yVal => {
        const key = `${xVal}-${yVal}`;
        const value = dataMap.get(key) || 0;

        g.append("rect")
          .attr("x", x(xVal)!)
          .attr("y", y(yVal)!)
          .attr("width", x.bandwidth())
          .attr("height", y.bandwidth())
          .attr("fill", colorScale(value))
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .append("title")
          .text(`${xField}: ${xVal}\n${yField}: ${yVal}\n${valueField}: ${value}`);
      });
    });

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    g.append("g")
      .call(d3.axisLeft(y));
  }, [config]);

  return <svg ref={svgRef} width={600} height={300} />;
};

const D3Sankey = ({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !config.data) return;

    let sourceField = config.source;
    let targetField = config.target;
    let weightField = config.weight || config.value || config.valueField;

    if ((!sourceField || !targetField) && config.data && config.data.length > 0) {
      const dataKeys = Object.keys(config.data[0]);
      const categoricalFields = dataKeys.filter(key => {
        const sampleValues = config.data.slice(0, 10).map(row => row[key]);
        const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
        return numericValues.length < sampleValues.length * 0.5;
      });

      sourceField = sourceField || categoricalFields[0] || dataKeys[0];
      targetField = targetField || categoricalFields[1] || dataKeys[1];

      if (!weightField) {
        const numericFields = dataKeys.filter(key => {
          const sampleValues = config.data.slice(0, 10).map(row => row[key]);
          const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
          return numericValues.length > sampleValues.length * 0.7;
        });
        weightField = numericFields[0] || 'value';
      }
    }

    if (!svgRef.current || !config.data || !sourceField || !targetField) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const links = config.data.map(d => ({
      source: d[sourceField!],
      target: d[targetField!],
      value: +(d[weightField!] || 1)
    }));

    const nodes = Array.from(new Set([
      ...links.map(d => d.source),
      ...links.map(d => d.target)
    ])).map(name => ({ name }));

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const sourceNodes = nodes.filter(n => links.some(l => l.source === n.name));
    const targetNodes = nodes.filter(n => links.some(l => l.target === n.name));

    const nodeHeight = height / Math.max(sourceNodes.length, targetNodes.length) - 10;
    const nodeWidth = 20;

    sourceNodes.forEach((node, i) => {
      const y = (height / sourceNodes.length) * i + 5;
      g.append("rect")
        .attr("x", 50)
        .attr("y", y)
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("fill", COLORS[i % COLORS.length]);

      g.append("text")
        .attr("x", 45)
        .attr("y", y + nodeHeight / 2)
        .attr("text-anchor", "end")
        .attr("alignment-baseline", "middle")
        .attr("font-size", "12px")
        .text(node.name);
    });

    targetNodes.forEach((node, i) => {
      const y = (height / targetNodes.length) * i + 5;
      g.append("rect")
        .attr("x", width - 70)
        .attr("y", y)
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("fill", COLORS[i % COLORS.length]);

      g.append("text")
        .attr("x", width - 45)
        .attr("y", y + nodeHeight / 2)
        .attr("text-anchor", "start")
        .attr("alignment-baseline", "middle")
        .attr("font-size", "12px")
        .text(node.name);
    });

    links.forEach((link, i) => {
      const sourceIndex = sourceNodes.findIndex(n => n.name === link.source);
      const targetIndex = targetNodes.findIndex(n => n.name === link.target);

      if (sourceIndex >= 0 && targetIndex >= 0) {
        const sourceY = (height / sourceNodes.length) * sourceIndex + nodeHeight / 2 + 5;
        const targetY = (height / targetNodes.length) * targetIndex + nodeHeight / 2 + 5;

        const path = `M ${50 + nodeWidth} ${sourceY}
                     C ${width / 2} ${sourceY} ${width / 2} ${targetY} ${width - 70} ${targetY}`;

        g.append("path")
          .attr("d", path)
          .attr("stroke", COLORS[i % COLORS.length])
          .attr("stroke-width", Math.max(2, Math.min(10, link.value / 2)))
          .attr("fill", "none")
          .attr("opacity", 0.6);
      }
    });
  }, [config]);

  return <svg ref={svgRef} width={600} height={300} />;
};

const ChartRenderer = memo(({ config, chartType }: ChartRendererProps) => {
  // Use performance optimization hook
  const {
    processedData,
    metrics,
    performanceInfo
  } = useChartPerformance({
    chartType,
    data: config.data,
    enableSampling: true,
    preserveOutliers: chartType === 'box_plot' || chartType === 'histogram'
  });

  // Memoized processed config
  const processedConfig = useMemo(() => {
    if (!processedData) return null;
    
    return {
      ...config,
      data: processedData,
      originalDataLength: performanceInfo?.originalSize || 0,
      sampledDataLength: performanceInfo?.processedSize || 0
    };
  }, [config, processedData, performanceInfo]);

  const renderChart = useCallback(() => {
    if (!processedConfig) return <g />;
    switch (chartType) {
      case 'line':
        // Auto-detect fields for line chart  
        let lineXField = processedConfig.xAxis || processedConfig.chartSpecificConfig?.xAxis;
        let lineYField = processedConfig.yAxis || processedConfig.chartSpecificConfig?.yAxis;
        
        if (!lineXField || !lineYField) {
          const sampleData = processedConfig.data?.[0];
          if (sampleData) {
            const fields = Object.keys(sampleData);
            const numericFields = fields.filter(key => {
              const value = sampleData[key];
              return !isNaN(parseFloat(value)) && isFinite(value);
            });
            
            // For line charts, both axes typically need to be numeric or X can be categorical
            lineXField = lineXField || fields[0]; // First field for X
            lineYField = lineYField || numericFields[0]; // First numeric field for Y
          }
        }
        
        if (!lineXField || !lineYField) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-center">
                <p className="text-gray-500 mb-2">Line chart requires both X and Y axis fields</p>
                <p className="text-xs text-gray-400">
                  Available fields: {Object.keys(processedConfig.data?.[0] || {}).join(', ')}
                </p>
              </div>
            </div>
          );
        }

        // Process line chart data
        const lineData = processedConfig.data
          .filter((d: any) => d[lineXField!] !== null && d[lineYField!] !== null)
          .map((d: any) => ({
            ...d,
            [lineYField!]: Number(d[lineYField!])
          }))
          .filter((d: any) => !isNaN(d[lineYField!]) && isFinite(d[lineYField!]));

        if (lineData.length === 0) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No valid data for line chart</p>
            </div>
          );
        }

        return (
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={lineXField || 'x'}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(label) => `${lineXField}: ${label}`}
              formatter={(value: any, _name: string) => [Number(value).toFixed(2), lineYField]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={lineYField || 'y'}
              stroke={COLORS[0]}
              strokeWidth={2}
              dot={{ fill: COLORS[0], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );

    case 'bar':
      // Auto-detect fields for bar chart
      let barXField = processedConfig.xAxis || processedConfig.chartSpecificConfig?.xAxis;
      let barYField = processedConfig.yAxis || processedConfig.chartSpecificConfig?.yAxis;
      
      if (!barXField || !barYField) {
        const { numeric, categorical } = detectFieldTypes(processedConfig.data || []);
        barXField = barXField || categorical[0] || Object.keys(processedConfig.data?.[0] || {})[0];
        barYField = barYField || numeric[0];
      }
      
      if (!barXField || !barYField) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
              <p className="text-gray-500 mb-2">Bar chart requires both X and Y axis fields</p>
              <p className="text-xs text-gray-400">
                Available fields: {Object.keys(processedConfig.data?.[0] || {}).join(', ')}
              </p>
            </div>
          </div>
        );
      }
      
      // Process bar chart data
      const barData = processedConfig.data
        .filter((d: any) => d[barXField!] !== null && d[barYField!] !== null)
        .map((d: any) => ({
          ...d,
          [barYField!]: Number(d[barYField!])
        }))
        .filter((d: any) => !isNaN(d[barYField!]) && isFinite(d[barYField!]));

      if (barData.length === 0) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">No valid data for bar chart</p>
          </div>
        );
      }

      return (
        <BarChart data={barData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={barXField || 'x'}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(label) => `${barXField}: ${label}`}
            formatter={(value: any, _name: string) => [Number(value).toFixed(2), barYField]}
          />
          <Legend />
          <Bar
            dataKey={barYField || 'y'}
            fill={COLORS[1]}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      );

    case 'scatter':
      // Auto-detect fields for scatter chart
      let scatterXField = processedConfig.xAxis || processedConfig.chartSpecificConfig?.xAxis;
      let scatterYField = processedConfig.yAxis || processedConfig.chartSpecificConfig?.yAxis;
      
      if (!scatterXField || !scatterYField) {
        const { numeric } = detectFieldTypes(processedConfig.data || []);
        scatterXField = scatterXField || numeric[0];
        scatterYField = scatterYField || numeric[1];
      }
      
      if (!scatterXField || !scatterYField) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
              <p className="text-gray-500 mb-2">Scatter plot requires two numeric fields</p>
              <p className="text-xs text-gray-400">
                Available fields: {Object.keys(processedConfig.data?.[0] || {}).join(', ')}
              </p>
            </div>
          </div>
        );
      }
      
      // Ensure scatter plot has valid numeric data
      const scatterData = processedConfig.data
        .filter((d: any) => d[scatterXField!] !== null && d[scatterYField!] !== null)
        .map((d: any) => ({
          ...d,
          [scatterXField!]: Number(d[scatterXField!]),
          [scatterYField!]: Number(d[scatterYField!])
        }))
        .filter((d: any) => !isNaN(d[scatterXField!]) && !isNaN(d[scatterYField!]) && isFinite(d[scatterXField!]) && isFinite(d[scatterYField!]));

      if (scatterData.length === 0) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">No valid numeric data for scatter plot</p>
          </div>
        );
      }

      return (
        <ScatterChart data={scatterData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={scatterXField || 'x'}
            type="number"
            tick={{ fontSize: 12 }}
            name={scatterXField}
          />
          <YAxis
            dataKey={scatterYField || 'y'}
            type="number"
            tick={{ fontSize: 12 }}
            name={scatterYField}
          />
          <Tooltip
            formatter={(value: any, name: string) => [Number(value).toFixed(2), name]}
            labelFormatter={(label) => `${scatterXField}: ${Number(label).toFixed(2)}`}
          />
          <Legend />
          <Scatter
            name={scatterYField}
            dataKey={scatterYField || 'y'}
            fill={COLORS[2]}
          />
        </ScatterChart>
      );

    case 'pie':
      // Auto-detect fields for pie chart
      let pieCategoryField = processedConfig.category || processedConfig.chartSpecificConfig?.category || processedConfig.xAxis;
      let pieValueField = processedConfig.value || processedConfig.chartSpecificConfig?.value || processedConfig.yAxis;
      
      if (!pieCategoryField || !pieValueField) {
        const { numeric, categorical } = detectFieldTypes(processedConfig.data || []);
        pieCategoryField = pieCategoryField || categorical[0];
        pieValueField = pieValueField || numeric[0];
      }
      
      if (!pieCategoryField || !pieValueField) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
              <p className="text-gray-500 mb-2">Pie chart requires category and value fields</p>
              <p className="text-xs text-gray-400">
                Available fields: {Object.keys(processedConfig.data?.[0] || {}).join(', ')}
              </p>
            </div>
          </div>
        );
      }
      
      // Process pie data to ensure valid numeric values
      const pieData = processedConfig.data
        .slice(0, 10)
        .filter((d: any) => d[pieCategoryField!] !== null && d[pieValueField!] !== null)
        .map((d: any) => ({
          ...d,
          [pieValueField!]: Number(d[pieValueField!])
        }))
        .filter((d: any) => !isNaN(d[pieValueField!]) && isFinite(d[pieValueField!]) && d[pieValueField!] >= 0);

      if (pieData.length === 0) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">No valid data for pie chart</p>
          </div>
        );
      }

      return (
        <PieChart>
          <Pie
            data={pieData}
            dataKey={pieValueField}
            nameKey={pieCategoryField}
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, name: string) => [Number(value).toFixed(2), name]}
          />
          <Legend />
        </PieChart>
      );

    case 'area':
      // Auto-detect fields for area chart
      let areaXField = processedConfig.xAxis || processedConfig.chartSpecificConfig?.xAxis;
      let areaYField = processedConfig.yAxis || processedConfig.chartSpecificConfig?.yAxis;
      
      if (!areaXField || !areaYField) {
        const { numeric } = detectFieldTypes(processedConfig.data || []);
        const fields = Object.keys(processedConfig.data?.[0] || {});
        areaXField = areaXField || fields[0];
        areaYField = areaYField || numeric[0];
      }
      
      if (!areaXField || !areaYField) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
              <p className="text-gray-500 mb-2">Area chart requires both X and Y axis fields</p>
              <p className="text-xs text-gray-400">
                Available fields: {Object.keys(processedConfig.data?.[0] || {}).join(', ')}
              </p>
            </div>
          </div>
        );
      }
      
      // Process area chart data
      const areaData = processedConfig.data
        .filter((d: any) => d[areaXField!] !== null && d[areaYField!] !== null)
        .map((d: any) => ({
          ...d,
          [areaYField!]: Number(d[areaYField!])
        }))
        .filter((d: any) => !isNaN(d[areaYField!]) && isFinite(d[areaYField!]));

      if (areaData.length === 0) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">No valid data for area chart</p>
          </div>
        );
      }

      return (
        <AreaChart data={areaData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={areaXField || 'x'}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(label) => `${areaXField}: ${label}`}
            formatter={(value: any, _name: string) => [Number(value).toFixed(2), areaYField]}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey={areaYField || 'y'}
            stroke={COLORS[6]}
            fill={COLORS[6]}
            fillOpacity={0.6}
          />
        </AreaChart>
      );

    case 'treemap':
      // Auto-detect fields for treemap
      let treemapCategoryField = processedConfig.category || processedConfig.hierarchyField || processedConfig.xAxis;
      let treemapValueField = processedConfig.value || processedConfig.yAxis;
      
      if (!treemapCategoryField || !treemapValueField) {
        const { numeric, categorical } = detectFieldTypes(processedConfig.data || []);
        treemapCategoryField = treemapCategoryField || categorical[0];
        treemapValueField = treemapValueField || numeric[0];
      }

      if (!treemapCategoryField || !treemapValueField) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
              <p className="text-gray-500 mb-2">Treemap requires category and value fields</p>
              <p className="text-xs text-gray-400">
                Available fields: {Object.keys(processedConfig.data?.[0] || {}).join(', ')}
              </p>
            </div>
          </div>
        );
      }

      const treemapData = processedConfig.data
        .filter((d: any) => d[treemapCategoryField!] !== null && d[treemapValueField!] !== null)
        .map((item: any, index: number) => ({
          name: String(item[treemapCategoryField!]),
          size: Math.max(0, Number(item[treemapValueField!]) || 0),
          fill: COLORS[index % COLORS.length]
        }))
        .filter(d => d.size > 0 && isFinite(d.size));

      if (treemapData.length === 0) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">No valid data for treemap</p>
          </div>
        );
      }

      return (
        <Treemap
          data={treemapData}
          dataKey="size"
          aspectRatio={4/3}
          stroke="#fff"
          fill={COLORS[7]}
        />
      );

    case 'histogram':
      return <D3Histogram config={processedConfig} />;

    case 'box_plot':
      return <D3BoxPlot config={processedConfig} />;

    case 'heatmap':
      return <D3Heatmap config={processedConfig} />;

    case 'sankey':
      return <D3Sankey config={processedConfig} />;

      default:
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">Chart type not yet supported</p>
          </div>
        );
    }
  }, [chartType, processedConfig]);

  if (!processedConfig) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">No data available for visualization</p>
      </div>
    );
  }

  // D3 charts need to be rendered directly, not wrapped in ResponsiveContainer
  const isD3Chart = ['histogram', 'box_plot', 'heatmap', 'sankey'].includes(chartType);
  
  if (isD3Chart) {
    return (
      <div className="w-full h-80 flex flex-col">
        {/* Performance indicator for D3 charts */}
        {metrics && performanceInfo && (
          <div className="mb-2">
            <PerformanceIndicator
              metrics={metrics}
              originalSize={performanceInfo.originalSize}
              processedSize={performanceInfo.processedSize}
              className="text-xs"
              showDetails={false}
            />
          </div>
        )}
        
        <div className="flex-1 flex items-center justify-center">
          {renderChart()}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-80 flex flex-col">
      {/* Performance indicator */}
      {metrics && performanceInfo && (
        <div className="mb-2">
          <PerformanceIndicator
            metrics={metrics}
            originalSize={performanceInfo.originalSize}
            processedSize={performanceInfo.processedSize}
            className="text-xs"
            showDetails={false}
          />
        </div>
      )}
      
      <div className="flex-1 relative">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default ChartRenderer;