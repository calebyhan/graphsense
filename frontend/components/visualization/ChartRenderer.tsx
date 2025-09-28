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

    // Auto-detect numeric field for histogram
    let valueField = config.value || config.yAxis || config.xAxis || config.chartSpecificConfig?.value;
    
    if (!valueField) {
      const sampleData = config.data?.[0];
      if (sampleData) {
        const numericFields = Object.keys(sampleData).filter(key => {
          const value = sampleData[key];
          return !isNaN(parseFloat(value)) && isFinite(value);
        });
        valueField = numericFields[0];
        console.log('📊 Histogram auto-detected field:', valueField, 'from', numericFields);
      }
    }
    
    if (!valueField) {
      svg.append("text")
        .attr("x", 300)
        .attr("y", 150)
        .attr("text-anchor", "middle")
        .text("Histogram requires a numeric field");
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
    console.log('📦 D3BoxPlot useEffect called:', { 
      hasSvgRef: !!svgRef.current, 
      hasData: !!config.data, 
      dataLength: config?.data?.length,
      config: config,
      sampleData: config?.data?.slice(0, 3)
    });

    if (!svgRef.current || !config.data) {
      console.warn('⚠️ D3BoxPlot: Missing svgRef or data');
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    // Auto-detect yAxis field if not provided
    let yAxisField = config.yAxis;
    if (!yAxisField && config.data && config.data.length > 0) {
      const dataKeys = Object.keys(config.data[0]);
      console.log('🔍 D3BoxPlot auto-detecting yAxis field from keys:', dataKeys);
      
      // Find the first numeric column
      yAxisField = dataKeys.find(key => {
        const sampleValues = config.data.slice(0, 10).map(row => row[key]);
        const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
        return numericValues.length > sampleValues.length * 0.7; // At least 70% numeric
      });
      
      console.log('📊 D3BoxPlot auto-detected yAxis field:', yAxisField);
    }

    if (!yAxisField) {
      console.error('❌ D3BoxPlot: No suitable numeric field found for yAxis');
      return;
    }

    console.log('✅ D3BoxPlot proceeding with yAxis field:', yAxisField);

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
      .call(d3.axisBottom(d3.scaleBand().domain([yAxisField!]).range([center - 50, center + 50])));

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

    // Auto-detect fields if not provided
    let xField = config.rowField || config.xAxis;
    let yField = config.colField || config.yAxis;
    let valueField = config.valueField || config.value;

    if ((!xField || !yField || !valueField) && config.data && config.data.length > 0) {
      const dataKeys = Object.keys(config.data[0]);
      console.log('🔍 D3Heatmap auto-detecting fields from keys:', dataKeys);
      
      // Auto-detect xField (first categorical/string field)
      if (!xField) {
        xField = dataKeys.find(key => {
          const sampleValues = config.data.slice(0, 10).map(row => row[key]);
          const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
          return numericValues.length < sampleValues.length * 0.5; // Less than 50% numeric (categorical)
        }) || dataKeys[0];
        console.log('🎯 Auto-detected xField:', xField);
      }
      
      // Auto-detect yField (second categorical/string field, different from xField)
      if (!yField) {
        yField = dataKeys.find(key => {
          if (key === xField) return false;
          const sampleValues = config.data.slice(0, 10).map(row => row[key]);
          const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
          return numericValues.length < sampleValues.length * 0.5; // Less than 50% numeric (categorical)
        }) || dataKeys[1] || dataKeys[0];
        console.log('🎯 Auto-detected yField:', yField);
      }
      
      // Auto-detect valueField (first numeric field, different from x and y)
      if (!valueField) {
        valueField = dataKeys.find(key => {
          if (key === xField || key === yField) return false;
          const sampleValues = config.data.slice(0, 10).map(row => row[key]);
          const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
          return numericValues.length > sampleValues.length * 0.7; // At least 70% numeric
        }) || dataKeys.find(key => key !== xField && key !== yField) || dataKeys[2] || dataKeys[1];
        console.log('🎯 Auto-detected valueField:', valueField);
      }
    }

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
    console.log('🔗 D3Sankey useEffect called:', { 
      hasSvgRef: !!svgRef.current, 
      hasData: !!config.data, 
      dataLength: config?.data?.length,
      config: config,
      sampleData: config?.data?.slice(0, 3)
    });

    // Auto-detect source and target fields if not provided
    let sourceField = config.source;
    let targetField = config.target;
    let weightField = config.weight || config.value || config.valueField;

    if ((!sourceField || !targetField) && config.data && config.data.length > 0) {
      const dataKeys = Object.keys(config.data[0]);
      console.log('🔍 D3Sankey auto-detecting fields from keys:', dataKeys);
      
      // For Sankey, we need at least 2 categorical fields and optionally 1 numeric field
      const categoricalFields = dataKeys.filter(key => {
        const sampleValues = config.data.slice(0, 10).map(row => row[key]);
        const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
        return numericValues.length < sampleValues.length * 0.5; // Less than 50% numeric (categorical)
      });
      
      sourceField = sourceField || categoricalFields[0] || dataKeys[0];
      targetField = targetField || categoricalFields[1] || dataKeys[1];
      
      if (!weightField) {
        const numericFields = dataKeys.filter(key => {
          const sampleValues = config.data.slice(0, 10).map(row => row[key]);
          const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
          return numericValues.length > sampleValues.length * 0.7; // At least 70% numeric
        });
        weightField = numericFields[0] || 'value';
      }
      
      console.log('🎯 D3Sankey auto-detected fields:', { sourceField, targetField, weightField });
    }

    if (!svgRef.current || !config.data || !sourceField || !targetField) {
      console.warn('⚠️ D3Sankey: Missing required fields or data');
      return;
    }

    console.log('✅ D3Sankey proceeding with fields:', { sourceField, targetField, weightField });

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    // Create a simplified Sankey-like diagram using rectangles and paths
    // Group data by source and target
    const links = config.data.map(d => ({
      source: d[sourceField!],
      target: d[targetField!],
      value: +(d[weightField!] || 1)
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
    sampleData: config?.data?.slice(0, 2),
    fullConfig: config,
    xAxis: config?.xAxis,
    yAxis: config?.yAxis,
    chartSpecificConfig: config?.chartSpecificConfig
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
        // Auto-detect fields for line chart  
        let lineXField = config.xAxis || config.chartSpecificConfig?.xAxis;
        let lineYField = config.yAxis || config.chartSpecificConfig?.yAxis;
        
        if (!lineXField || !lineYField) {
          const sampleData = config.data?.[0];
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
                  Available fields: {Object.keys(config.data?.[0] || {}).join(', ')}
                </p>
              </div>
            </div>
          );
        }

        return (
          <LineChart data={config.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={lineXField}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(label) => `${lineXField}: ${label}`}
              formatter={(value: any, name: string) => [value, lineYField]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={lineYField}
              stroke={COLORS[0]}
              strokeWidth={2}
              dot={{ fill: COLORS[0], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );

      case 'bar':
        // Auto-detect fields for bar chart
        let barXField = config.xAxis || config.chartSpecificConfig?.xAxis || config.category;
        let barYField = config.yAxis || config.chartSpecificConfig?.yAxis || config.value;
        
        if (!barXField || !barYField) {
          const sampleData = config.data?.[0];
          if (sampleData) {
            const fields = Object.keys(sampleData);
            const numericFields = fields.filter(key => {
              const value = sampleData[key];
              return !isNaN(parseFloat(value)) && isFinite(value);
            });
            const textFields = fields.filter(key => {
              const value = sampleData[key];
              return typeof value === 'string' && isNaN(parseFloat(value));
            });
            
            console.log('🔍 Bar chart auto-detecting fields:', { 
              numericFields, 
              textFields, 
              allFields: fields 
            });
            
            // For bar charts, X should be categorical, Y should be numeric
            barXField = barXField || textFields[0] || fields[0]; // First text field or any field
            barYField = barYField || numericFields[0]; // First numeric field
            
            // If no numeric field found, try to count occurrences
            if (!barYField && barXField) {
              console.log('📊 No numeric field found, will aggregate by count');
              barYField = 'count';
            }
          }
        }
        
        console.log('📊 Bar chart using fields:', { 
          xField: barXField, 
          yField: barYField,
          dataLength: config.data?.length 
        });
        
        if (!barXField) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-center">
                <p className="text-gray-500 mb-2">Bar chart requires at least a category field</p>
                <p className="text-xs text-gray-400">
                  Available fields: {Object.keys(config.data?.[0] || {}).join(', ')}
                </p>
              </div>
            </div>
          );
        }

        // Aggregate data if using count
        let barData = config.data;
        if (barYField === 'count') {
          const counts: Record<string, number> = {};
          config.data.forEach(item => {
            const key = item[barXField];
            counts[key] = (counts[key] || 0) + 1;
          });
          barData = Object.entries(counts).map(([key, count]) => ({
            [barXField]: key,
            count: count
          }));
          console.log('📊 Aggregated bar data:', barData.slice(0, 5));
        }

        return (
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={barXField}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(label) => `${barXField}: ${label}`}
              formatter={(value: any, name: string) => [value, barYField]}
            />
            <Legend />
            <Bar
              dataKey={barYField}
              fill={COLORS[1]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      case 'scatter':
        // Try to get axis fields from config or chartSpecificConfig
        let xField = config.xAxis || config.chartSpecificConfig?.xAxis || config.chartSpecificConfig?.x;
        let yField = config.yAxis || config.chartSpecificConfig?.yAxis || config.chartSpecificConfig?.y;
        
        // Auto-detect numeric fields if axis fields are not specified
        if (!xField || !yField) {
          const sampleData = config.data?.[0];
          if (sampleData) {
            const numericFields = Object.keys(sampleData).filter(key => {
              const value = sampleData[key];
              return !isNaN(parseFloat(value)) && isFinite(value);
            });
            
            console.log('🔍 Auto-detecting numeric fields:', numericFields);
            
            // For location data, prioritize longitude/latitude
            if (numericFields.includes('longitude') && numericFields.includes('latitude')) {
              xField = xField || 'longitude';
              yField = yField || 'latitude';
            } else if (numericFields.length >= 2) {
              xField = xField || numericFields[0];
              yField = yField || numericFields[1];
            }
          }
        }
        
        console.log('🎯 Rendering scatter chart with config:', {
          xAxis: xField,
          yAxis: yField,
          dataLength: config.data?.length,
          samplePoint: config.data?.[0],
          hasXData: xField && config.data?.some(d => d[xField] !== undefined),
          hasYData: yField && config.data?.some(d => d[yField] !== undefined),
          autoDetected: !config.xAxis && !config.yAxis
        });
        
        if (!xField || !yField) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-center">
                <p className="text-gray-500 mb-2">Scatter plot requires both X and Y axis fields</p>
                <p className="text-xs text-gray-400">
                  Available fields: {Object.keys(config.data?.[0] || {}).join(', ')}
                </p>
              </div>
            </div>
          );
        }
        
        // Transform data to ensure numeric values for scatter plot
        const scatterData = config.data?.map((item, index) => ({
          ...item,
          x: parseFloat(item[xField]) || 0,
          y: parseFloat(item[yField]) || 0,
          name: item[xField] || `Point ${index + 1}`
        })).filter(item => !isNaN(item.x) && !isNaN(item.y));

        console.log('📊 Scatter data transformed:', {
          originalLength: config.data?.length,
          transformedLength: scatterData?.length,
          sample: scatterData?.slice(0, 3)
        });

        if (!scatterData || scatterData.length === 0) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No numeric data available for scatter plot</p>
            </div>
          );
        }

        return (
          <ScatterChart
            width={600}
            height={400}
            data={scatterData}
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={xField}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yField}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value: any, name: string) => [
                typeof value === 'number' ? value.toFixed(2) : value, 
                name === 'x' ? xField : yField
              ]}
            />
            <Scatter
              name={`${yField} vs ${xField}`}
              dataKey="y"
              fill={COLORS[2]}
            />
          </ScatterChart>
        );

      case 'pie':
        // Auto-detect fields for pie chart
        let pieCategoryField = config.category || config.chartSpecificConfig?.category || config.xAxis;
        let pieValueField = config.value || config.chartSpecificConfig?.value || config.yAxis;
        
        if (!pieCategoryField || !pieValueField) {
          const sampleData = config.data?.[0];
          if (sampleData) {
            const fields = Object.keys(sampleData);
            const numericFields = fields.filter(key => {
              const value = sampleData[key];
              return !isNaN(parseFloat(value)) && isFinite(value);
            });
            const textFields = fields.filter(key => {
              const value = sampleData[key];
              return typeof value === 'string' && isNaN(parseFloat(value));
            });
            
            console.log('🥧 Pie chart auto-detecting fields:', { 
              numericFields, 
              textFields, 
              allFields: fields 
            });
            
            // For pie charts, category should be text, value should be numeric
            pieCategoryField = pieCategoryField || textFields[0] || fields[0];
            pieValueField = pieValueField || numericFields[0];
            
            // If no numeric field, use count
            if (!pieValueField && pieCategoryField) {
              console.log('🥧 No numeric field found, will aggregate by count');
              pieValueField = 'count';
            }
          }
        }
        
        console.log('🥧 Pie chart using fields:', { 
          categoryField: pieCategoryField, 
          valueField: pieValueField 
        });
        
        if (!pieCategoryField) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-center">
                <p className="text-gray-500 mb-2">Pie chart requires a category field</p>
                <p className="text-xs text-gray-400">
                  Available fields: {Object.keys(config.data?.[0] || {}).join(', ')}
                </p>
              </div>
            </div>
          );
        }

        // Aggregate data if using count or if we have a value field
        let pieData = config.data;
        if (pieValueField === 'count' || pieValueField) {
          const aggregated: Record<string, number> = {};
          config.data.forEach(item => {
            const key = item[pieCategoryField];
            if (pieValueField === 'count') {
              aggregated[key] = (aggregated[key] || 0) + 1;
            } else {
              const value = parseFloat(item[pieValueField]) || 0;
              aggregated[key] = (aggregated[key] || 0) + value;
            }
          });
          pieData = Object.entries(aggregated).map(([key, value]) => ({
            [pieCategoryField]: key,
            [pieValueField]: value
          }));
        }
        
        // Limit to 10 slices for readability
        pieData = pieData.slice(0, 10);
        
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
              formatter={(value: any, name: string) => [value, name]}
            />
            <Legend />
          </PieChart>
        );

      case 'area':
        // Auto-detect fields for area chart
        let areaXField = config.xAxis || config.chartSpecificConfig?.xAxis;
        let areaYField = config.yAxis || config.chartSpecificConfig?.yAxis || config.value;
        
        if (!areaXField || !areaYField) {
          const sampleData = config.data?.[0];
          if (sampleData) {
            const fields = Object.keys(sampleData);
            const numericFields = fields.filter(key => {
              const value = sampleData[key];
              return !isNaN(parseFloat(value)) && isFinite(value);
            });
            
            console.log('📈 Area chart auto-detecting fields:', { numericFields, allFields: fields });
            
            // For area charts, X can be categorical or numeric, Y should be numeric
            areaXField = areaXField || fields[0];
            areaYField = areaYField || numericFields[0];
          }
        }
        
        console.log('📈 Area chart using fields:', { 
          xField: areaXField, 
          yField: areaYField 
        });
        
        if (!areaXField || !areaYField) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-center">
                <p className="text-gray-500 mb-2">Area chart requires both X and Y axis fields</p>
                <p className="text-xs text-gray-400">
                  Available fields: {Object.keys(config.data?.[0] || {}).join(', ')}
                </p>
              </div>
            </div>
          );
        }

        return (
          <AreaChart data={config.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={areaXField}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(label) => `${areaXField}: ${label}`}
              formatter={(value: any, name: string) => [value, areaYField]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey={areaYField}
              stroke={COLORS[6]}
              fill={COLORS[6]}
              fillOpacity={0.6}
            />
          </AreaChart>
        );

      case 'treemap':
        // Auto-detect fields for treemap
        let treemapCategoryField = config.category || config.hierarchyField || config.xAxis || config.chartSpecificConfig?.category;
        let treemapValueField = config.value || config.yAxis || config.chartSpecificConfig?.value;
        
        if (!treemapCategoryField || !treemapValueField) {
          const sampleData = config.data?.[0];
          if (sampleData) {
            const fields = Object.keys(sampleData);
            const numericFields = fields.filter(key => {
              const value = sampleData[key];
              return !isNaN(parseFloat(value)) && isFinite(value);
            });
            const textFields = fields.filter(key => {
              const value = sampleData[key];
              return typeof value === 'string' && isNaN(parseFloat(value));
            });
            
            console.log('🌳 Treemap auto-detecting fields:', { 
              numericFields, 
              textFields, 
              allFields: fields 
            });
            
            // For treemaps, category should be text, value should be numeric
            treemapCategoryField = treemapCategoryField || textFields[0] || fields[0];
            treemapValueField = treemapValueField || numericFields[0];
            
            // If no numeric field, use count
            if (!treemapValueField && treemapCategoryField) {
              console.log('🌳 No numeric field found, will aggregate by count');
              treemapValueField = 'count';
            }
          }
        }
        
        console.log('🌳 Treemap using fields:', { 
          categoryField: treemapCategoryField, 
          valueField: treemapValueField 
        });
        
        if (!treemapCategoryField) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-center">
                <p className="text-gray-500 mb-2">Treemap requires a category field</p>
                <p className="text-xs text-gray-400">
                  Available fields: {Object.keys(config.data?.[0] || {}).join(', ')}
                </p>
              </div>
            </div>
          );
        }
        
        // Aggregate data if using count or prepare treemap data
        let treemapRawData = config.data;
        if (treemapValueField === 'count') {
          const counts: Record<string, number> = {};
          config.data.forEach(item => {
            const key = item[treemapCategoryField];
            counts[key] = (counts[key] || 0) + 1;
          });
          treemapRawData = Object.entries(counts).map(([key, count]) => ({
            [treemapCategoryField]: key,
            count: count
          }));
        }
        
        const treemapData = treemapRawData.map((item, index) => ({
          name: item[treemapCategoryField],
          size: +item[treemapValueField] || 0,
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