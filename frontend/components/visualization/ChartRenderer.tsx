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
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

type ChartType = 'line' | 'bar' | 'scatter' | 'pie' | 'histogram' | 'box_plot' | 'heatmap' | 'area' | 'treemap' | 'sankey';

interface ChartRendererProps {
  config: ChartConfig;
  chartType: ChartType;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
];

// D3.js Chart Components
const D3Histogram = ({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !config.data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    // Use the new parameter structure
    const valueField = config.value || config.yAxis || config.xAxis;
    
    if (!valueField) {
      svg.append("text")
        .attr("x", 300)
        .attr("y", 150)
        .attr("text-anchor", "middle")
        .text("Histogram requires a value field");
      return;
    }

    const data = config.data
      .map(d => +d[valueField])
      .filter(d => !isNaN(d) && isFinite(d));

    if (data.length === 0) {
      svg.append("text")
        .attr("x", 300)
        .attr("y", 150)
        .attr("text-anchor", "middle")
        .text("No numeric data available");
      return;
    }

    const bins = config.bins || Math.min(30, Math.max(10, Math.ceil(Math.sqrt(data.length))));

    const x = d3.scaleLinear()
      .domain(d3.extent(data) as [number, number])
      .range([0, width]);

    const histogram = d3.histogram()
      .value(d => d)
      .domain(x.domain() as [number, number])
      .thresholds(bins);

    const binData = histogram(data);

    const y = d3.scaleLinear()
      .domain([0, d3.max(binData, d => d.length)!])
      .range([height, 0]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Color scale for bins (optional)
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

    // Add axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format(".2f")))
      .append("text")
      .attr("x", width / 2)
      .attr("y", 35)
      .attr("text-anchor", "middle")
      .attr("fill", "black")
      .text(valueField);

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
      const mean = d3.mean(data)!;
      const std = d3.deviation(data)!;

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
  }, [config]);

  return <svg ref={svgRef} width={600} height={300} />;
};

const D3BoxPlot = ({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !config.data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const data = config.data.map(d => +d[config.yAxis!]).sort(d3.ascending);

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

    // Box
    g.append("rect")
      .attr("x", center - boxWidth / 2)
      .attr("y", y(q3))
      .attr("width", boxWidth)
      .attr("height", y(q1) - y(q3))
      .attr("fill", COLORS[5])
      .attr("opacity", 0.7);

    // Median line
    g.append("line")
      .attr("x1", center - boxWidth / 2)
      .attr("x2", center + boxWidth / 2)
      .attr("y1", y(median))
      .attr("y2", y(median))
      .attr("stroke", "black")
      .attr("stroke-width", 2);

    // Whiskers
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
      .call(d3.axisBottom(d3.scaleBand().domain([config.yAxis!]).range([center - 50, center + 50])));

    g.append("g")
      .call(d3.axisLeft(y));
  }, [config]);

  return <svg ref={svgRef} width={600} height={300} />;
};

const D3Heatmap = ({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    console.log('🔥 D3Heatmap useEffect called:', { 
      hasSvgRef: !!svgRef.current, 
      hasData: !!config.data, 
      dataLength: config?.data?.length,
      config: config,
      sampleData: config?.data?.slice(0, 3)
    });

    if (!svgRef.current || !config.data) {
      console.warn('⚠️ D3Heatmap: Missing svgRef or data');
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 50, right: 80, bottom: 50, left: 80 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    // Use the new parameter structure
    const xField = config.rowField || config.xAxis;
    const yField = config.colField || config.yAxis;
    const valueField = config.valueField || config.value || config.yAxis;

    console.log('🔍 D3Heatmap field mapping:', { 
      xField, 
      yField, 
      valueField,
      configFields: {
        rowField: config.rowField,
        colField: config.colField,
        valueField: config.valueField,
        xAxis: config.xAxis,
        yAxis: config.yAxis,
        value: config.value
      }
    });

    if (!xField || !yField || !valueField) {
      console.error('❌ D3Heatmap: Missing required fields - trying emergency fallback');
      
      // Emergency fallback: use first available columns from data
      if (config.data && config.data.length > 0) {
        const dataKeys = Object.keys(config.data[0]);
        console.log('🆘 Emergency fallback - available data keys:', dataKeys);
        
        // Filter out empty/invalid keys first
        const validKeys = dataKeys.filter(key => key && key.trim() !== '');
        console.log('🔍 Valid keys after filtering:', validKeys);
        
        if (validKeys.length < 2) {
          console.log('❌ Not enough valid columns for heatmap');
          return;
        }
        
        // Use first valid columns available
        const emergencyXField = validKeys[0];
        const emergencyYField = validKeys[1];
        
        // Try to find a numeric column for values
        const emergencyValueField = validKeys.find(key => {
          const sampleValues = config.data.slice(0, 10).map(row => row[key]);
          return sampleValues.some(val => !isNaN(Number(val)) && val !== null && val !== '');
        }) || validKeys[2] || validKeys[1];
        
        console.log('🆘 Using emergency fields:', {
          emergencyXField,
          emergencyYField, 
          emergencyValueField
        });
        
        if (emergencyXField && emergencyYField && emergencyValueField) {
          console.log('✅ Proceeding with emergency heatmap rendering');
          
          // Check if this is wide-format data (many columns that look like categories)
          if (validKeys.length > 10 && validKeys.slice(1).every(key => isNaN(Number(key)))) {
            console.log('🔄 Detected wide-format data - transforming for heatmap');
            
            // Transform wide data to long format for heatmap
            // Use row index as X, column names as Y, values as heat values
            const transformedData: any[] = [];
            
            config.data.forEach((row, rowIndex) => {
              validKeys.slice(1, 21).forEach(columnName => { // Limit to first 20 columns
                const value = row[columnName];
                if (value !== null && value !== undefined && value !== '') {
                  transformedData.push({
                    rowIndex: rowIndex,
                    category: columnName,
                    value: Number(value) || 0
                  });
                }
              });
            });
            
            console.log('🔄 Transformed data sample:', transformedData.slice(0, 5));
            
            if (transformedData.length > 0) {
              // Use transformed data structure
              const xValues = Array.from(new Set(transformedData.map(d => d.rowIndex))).slice(0, 20);
              const yValues = Array.from(new Set(transformedData.map(d => d.category))).slice(0, 20);
              
              const x = d3.scaleBand()
                .domain(xValues.map(String))
                .range([0, width])
                .padding(0.05);

              const y = d3.scaleBand()
                .domain(yValues)
                .range([0, height])
                .padding(0.05);

              // Create a map for quick lookup
              const dataMap = new Map();
              transformedData.forEach(d => {
                const key = `${d.rowIndex}-${d.category}`;
                dataMap.set(key, d.value);
              });

              // Get value extent for color scale
              const values = Array.from(dataMap.values());
              const colorScale = d3.scaleSequential(d3.interpolateBlues)
                .domain(d3.extent(values) as [number, number]);

              const g = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

              // Create rectangles for each cell
              xValues.forEach(xVal => {
                yValues.forEach(yVal => {
                  const key = `${xVal}-${yVal}`;
                  const value = dataMap.get(key) || 0;
                  
                  if (value > 0) { // Only render non-zero values
                    g.append("rect")
                      .attr("x", x(String(xVal))!)
                      .attr("y", y(yVal)!)
                      .attr("width", x.bandwidth())
                      .attr("height", y.bandwidth())
                      .attr("fill", colorScale(value))
                      .attr("stroke", "#fff")
                      .attr("stroke-width", 1)
                      .append("title")
                      .text(`Row: ${xVal}\nState: ${yVal}\nValue: ${value}`);
                  }
                });
              });

              // Add axes labels
              g.append("text")
                .attr("x", width / 2)
                .attr("y", height + 40)
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .text("Data Rows");

              g.append("text")
                .attr("transform", "rotate(-90)")
                .attr("x", -height / 2)
                .attr("y", -60)
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .text("States");

              console.log('✅ Wide-format heatmap rendered successfully');
              return;
            }
          }
          
          // Fallback to normal heatmap rendering
          // Get unique values for axes (limit to prevent too many cells)
          const xValues = Array.from(new Set(config.data.map(d => d[emergencyXField]))).slice(0, 20);
          const yValues = Array.from(new Set(config.data.map(d => d[emergencyYField]))).slice(0, 20);

          const x = d3.scaleBand()
            .domain(xValues)
            .range([0, width])
            .padding(0.05);

          const y = d3.scaleBand()
            .domain(yValues)
            .range([0, height])
            .padding(0.05);

          // Create a map for quick lookup
          const dataMap = new Map();
          config.data.forEach(d => {
            const key = `${d[emergencyXField]}-${d[emergencyYField]}`;
            dataMap.set(key, +d[emergencyValueField] || 0);
          });

          // Get value extent for color scale
          const values = Array.from(dataMap.values());
          const colorScale = d3.scaleSequential(d3.interpolateBlues)
            .domain(d3.extent(values) as [number, number]);

          const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

          // Create rectangles for each cell
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
                .text(`${emergencyXField}: ${xVal}\n${emergencyYField}: ${yVal}\n${emergencyValueField}: ${value}`);
            });
          });

          // Add axes labels
          g.append("text")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .text(emergencyXField);

          g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -60)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .text(emergencyYField);

          console.log('✅ Emergency heatmap rendered successfully');
          return;
        }
      }
      
      console.error('❌ Emergency fallback also failed');
      // Show error message
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

    // Create a map for quick lookup
    const dataMap = new Map();
    config.data.forEach(d => {
      const key = `${d[xField]}-${d[yField]}`;
      dataMap.set(key, +d[valueField] || 0);
    });

    // Get value extent for color scale
    const values = Array.from(dataMap.values());
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain(d3.extent(values) as [number, number]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create rectangles for each cell
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

        // Add value text if requested
        if (config.chartSpecificConfig?.showValues) {
          g.append("text")
            .attr("x", x(xVal)! + x.bandwidth() / 2)
            .attr("y", y(yVal)! + y.bandwidth() / 2)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("font-size", "10px")
            .attr("fill", value > (d3.max(values)! * 0.5) ? "white" : "black")
            .text(value.toFixed(1));
        }
      });
    });

    // Add axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    g.append("g")
      .call(d3.axisLeft(y));

    // Add color legend
    const legendWidth = 20;
    const legendHeight = height;
    const legend = g.append("g")
      .attr("transform", `translate(${width + 20}, 0)`);

    const legendScale = d3.scaleLinear()
      .domain(colorScale.domain())
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickFormat(d3.format(".2f"));

    // Create gradient
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "heatmap-gradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0).attr("y1", legendHeight)
      .attr("x2", 0).attr("y2", 0);

    const gradientStops = d3.range(0, 1.1, 0.1).map((t, i) => ({ 
      offset: `${100 * i / 10}%`, 
      color: colorScale(colorScale.domain()[0] + t * (colorScale.domain()[1] - colorScale.domain()[0])) 
    }));
    
    gradient.selectAll("stop")
      .data(gradientStops)
      .enter().append("stop")
      .attr("offset", (d: any) => d.offset)
      .attr("stop-color", (d: any) => d.color);

    legend.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#heatmap-gradient)");

    legend.append("g")
      .attr("transform", `translate(${legendWidth}, 0)`)
      .call(legendAxis);
  }, [config]);

  return <svg ref={svgRef} width={600} height={300} />;
};

const D3Sankey = ({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !config.data || !config.source || !config.target) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    // Create a simplified Sankey-like diagram using rectangles and paths
    // Group data by source and target
    const links = config.data.map(d => ({
      source: d[config.source!],
      target: d[config.target!],
      value: +(d[config.weight || config.value || 'value'] || 1)
    }));

    // Get unique nodes
    const nodes = Array.from(new Set([
      ...links.map(d => d.source),
      ...links.map(d => d.target)
    ])).map(name => ({ name }));

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Simple layout: sources on left, targets on right
    const sourceNodes = nodes.filter(n => links.some(l => l.source === n.name));
    const targetNodes = nodes.filter(n => links.some(l => l.target === n.name));

    const nodeHeight = height / Math.max(sourceNodes.length, targetNodes.length) - 10;
    const nodeWidth = 20;

    // Draw source nodes
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

    // Draw target nodes
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

    // Draw simplified flows as curved paths
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

export default function ChartRenderer({ config, chartType }: ChartRendererProps) {
  // Debug logging for chart rendering
  console.log('🎨 ChartRenderer called:', { 
    chartType, 
    hasConfig: !!config, 
    hasData: !!config?.data, 
    dataLength: config?.data?.length,
    configKeys: config ? Object.keys(config) : [],
    sampleData: config?.data?.slice(0, 2)
  });

  if (!config.data || config.data.length === 0) {
    console.warn('⚠️ ChartRenderer: No data available', { config, chartType });
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">No data available for visualization</p>
      </div>
    );
  }

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={config.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={config.xAxis}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(label) => `${config.xAxis}: ${label}`}
              formatter={(value: any, name: string) => [value, config.yAxis]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={config.yAxis}
              stroke={COLORS[0]}
              strokeWidth={2}
              dot={{ fill: COLORS[0], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart data={config.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={config.xAxis}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(label) => `${config.xAxis}: ${label}`}
              formatter={(value: any, name: string) => [value, config.yAxis]}
            />
            <Legend />
            <Bar
              dataKey={config.yAxis}
              fill={COLORS[1]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      case 'scatter':
        return (
          <ScatterChart data={config.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={config.xAxis}
              type="number"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              dataKey={config.yAxis}
              type="number"
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: any, name: string) => [value, name]}
              labelFormatter={() => ''}
            />
            <Scatter
              dataKey={config.yAxis}
              fill={COLORS[2]}
            />
          </ScatterChart>
        );

      case 'pie':
        const pieData = config.data.slice(0, 10); // Limit to 10 slices for readability
        return (
          <PieChart>
            <Pie
              data={pieData}
              dataKey={config.value}
              nameKey={config.category}
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
              formatter={(value: any, name: string) => [value, name]}
            />
            <Legend />
          </PieChart>
        );

      case 'area':
        return (
          <AreaChart data={config.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={config.xAxis}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(label) => `${config.xAxis}: ${label}`}
              formatter={(value: any, name: string) => [value, config.yAxis]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey={config.yAxis || 'value'}
              stroke={COLORS[6]}
              fill={COLORS[6]}
              fillOpacity={0.6}
            />
          </AreaChart>
        );

      case 'treemap':
        // Prepare treemap data
        const categoryField = config.category || config.hierarchyField || config.xAxis;
        const valueField = config.value || config.yAxis;
        
        if (!categoryField || !valueField) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">Treemap requires category and value fields</p>
            </div>
          );
        }
        
        const treemapData = config.data.map((item, index) => ({
          name: item[categoryField],
          size: +item[valueField] || 0,
          fill: COLORS[index % COLORS.length]
        }));

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
        return <D3Histogram config={config} />;

      case 'box_plot':
        return <D3BoxPlot config={config} />;

      case 'heatmap':
        return <D3Heatmap config={config} />;

      case 'sankey':
        return <D3Sankey config={config} />;

      default:
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">Chart type not yet supported</p>
          </div>
        );
    }
  };

  // D3 charts need to be rendered directly, not wrapped in ResponsiveContainer
  const isD3Chart = ['histogram', 'box_plot', 'heatmap', 'sankey'].includes(chartType);
  
  if (isD3Chart) {
    return (
      <div className="w-full h-80 flex items-center justify-center">
        {renderChart()}
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}