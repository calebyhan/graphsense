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
import { useEffect, useRef, useState, useCallback } from 'react';
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


function validateChartConfig(config: ChartConfig, chartType: ChartType): ChartConfig | null {
  if (!config.data || config.data.length === 0) {
    return null;
  }

  const sampleData = config.data[0];
  const dataKeys = Object.keys(sampleData).filter(key => key && key.trim() !== '');

  // Analyze data types
  const numericFields = dataKeys.filter(key => {
    const sampleValues = config.data.slice(0, 20).map(row => row[key]);
    const numericValues = sampleValues.filter(val =>
      val !== null && val !== '' && !isNaN(Number(val)) && isFinite(Number(val))
    );
    return numericValues.length > sampleValues.length * 0.7; // 70% threshold
  });

  const categoricalFields = dataKeys.filter(key => !numericFields.includes(key));

  const validatedConfig = { ...config };

  switch (chartType) {
    case 'line':
    case 'area':
      // Need one categorical (x) and one numeric (y)
      if (!validatedConfig.xAxis) {
        validatedConfig.xAxis = categoricalFields[0] || dataKeys[0];
      }
      if (!validatedConfig.yAxis) {
        validatedConfig.yAxis = numericFields[0] || dataKeys.find(k => k !== validatedConfig.xAxis) || dataKeys[1];
      }
      break;

    case 'bar':
      // Need one categorical (x) and one numeric (y)
      if (!validatedConfig.xAxis) {
        validatedConfig.xAxis = categoricalFields[0] || numericFields[0] || dataKeys[0];
      }
      if (!validatedConfig.yAxis) {
        validatedConfig.yAxis = numericFields[0] || dataKeys.find(k => k !== validatedConfig.xAxis) || dataKeys[1];
      }
      break;

    case 'scatter':
      // Need two numeric fields
      if (!validatedConfig.xAxis) {
        validatedConfig.xAxis = numericFields[0] || dataKeys[0];
      }
      if (!validatedConfig.yAxis) {
        validatedConfig.yAxis = numericFields[1] || dataKeys.find(k => k !== validatedConfig.xAxis) || dataKeys[1];
      }
      break;

    case 'pie':
      // Need one categorical and one numeric
      if (!validatedConfig.category) {
        validatedConfig.category = categoricalFields[0] || dataKeys[0];
      }
      if (!validatedConfig.value) {
        validatedConfig.value = numericFields[0] || dataKeys.find(k => k !== validatedConfig.category) || dataKeys[1];
      }
      break;

    case 'treemap':
      // Need one categorical and one numeric
      if (!validatedConfig.category && !validatedConfig.hierarchyField) {
        validatedConfig.category = categoricalFields[0] || dataKeys[0];
      }
      if (!validatedConfig.value) {
        validatedConfig.value = numericFields[0] || dataKeys.find(k => k !== validatedConfig.category) || dataKeys[1];
      }
      break;

    case 'histogram':
      // Need one numeric field
      if (!validatedConfig.value && !validatedConfig.yAxis && !validatedConfig.xAxis) {
        validatedConfig.value = numericFields[0] || dataKeys[0];
      }
      break;

    case 'box_plot':
      // Need one numeric field
      if (!validatedConfig.yAxis) {
        validatedConfig.yAxis = numericFields[0] || dataKeys[0];
      }
      break;

    case 'heatmap':
      // Need two categorical and one numeric
      if (!validatedConfig.rowField && !validatedConfig.xAxis) {
        validatedConfig.rowField = categoricalFields[0] || dataKeys[0];
      }
      if (!validatedConfig.colField && !validatedConfig.yAxis) {
        validatedConfig.colField = categoricalFields[1] || dataKeys.find(k => k !== validatedConfig.rowField) || dataKeys[1];
      }
      if (!validatedConfig.valueField && !validatedConfig.value) {
        validatedConfig.valueField = numericFields[0] || dataKeys.find(k => k !== validatedConfig.rowField && k !== validatedConfig.colField) || dataKeys[2];
      }
      break;

    case 'sankey':
      // Need two categorical and one numeric
      if (!validatedConfig.source) {
        validatedConfig.source = categoricalFields[0] || dataKeys[0];
      }
      if (!validatedConfig.target) {
        validatedConfig.target = categoricalFields[1] || dataKeys.find(k => k !== validatedConfig.source) || dataKeys[1];
      }
      if (!validatedConfig.weight && !validatedConfig.value) {
        validatedConfig.weight = numericFields[0] || dataKeys.find(k => k !== validatedConfig.source && k !== validatedConfig.target) || dataKeys[2];
      }
      break;
  }

  return validatedConfig;
}

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

    let valueField = config.value || config.yAxis || config.xAxis;

    if (!valueField) {
      const sampleData = config.data?.[0];
      if (sampleData) {
        const numericFields = Object.keys(sampleData).filter(key => {
          const value = sampleData[key];
          return !isNaN(parseFloat(value)) && isFinite(value);
        });
        valueField = numericFields[0];
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

export default function ChartRenderer({ config, chartType }: ChartRendererProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Canvas positioning is handled by CanvasElement - no need for duplicate positioning logic
  useEffect(() => {
    if (!mounted) return;

    // Ensure chart is visible when mounted
    const chartElement = canvasRef.current?.closest('.chart-card');
    if (chartElement && 'style' in chartElement) {
      (chartElement as HTMLElement).style.visibility = 'visible';
    }
  }, [mounted]);

  if (!config.data || config.data.length === 0) {
    return (
      <div ref={canvasRef} className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">No data available - please analyze dataset first</p>
      </div>
    );
  }

  const renderChart = useCallback(() => {
    try {
      return renderChartForConfig(config, chartType);
    } catch (error) {
      console.error('Error rendering chart:', error);
      return (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">Error rendering chart</p>
        </div>
      );
    }
  }, [config, chartType]);

  const isD3Chart = ['histogram', 'box_plot', 'heatmap', 'sankey'].includes(chartType);

  if (isD3Chart) {
    return (
      <div ref={canvasRef} className="w-full h-80 flex items-center justify-center">
        {renderChart()}
      </div>
    );
  }

  return (
    <div ref={canvasRef} className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

function renderChartForConfig(config: ChartConfig, chartType: ChartType) {
  try {
    const validatedConfig = validateChartConfig(config, chartType);
    if (!validatedConfig) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">Invalid chart configuration</p>
        </div>
      );
    }

  switch (chartType) {
    case 'line':
      // Process line chart data
      const lineData = validatedConfig.data
        .filter(d => d[validatedConfig.xAxis!] !== null && d[validatedConfig.yAxis!] !== null)
        .map(d => ({
          ...d,
          [validatedConfig.yAxis!]: Number(d[validatedConfig.yAxis!])
        }))
        .filter(d => !isNaN(d[validatedConfig.yAxis!]) && isFinite(d[validatedConfig.yAxis!]));

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
            dataKey={validatedConfig.xAxis || 'x'}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(label) => `${validatedConfig.xAxis}: ${label}`}
            formatter={(value: any, name: string) => [Number(value).toFixed(2), validatedConfig.yAxis]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={validatedConfig.yAxis || 'y'}
            stroke={COLORS[0]}
            strokeWidth={2}
            dot={{ fill: COLORS[0], strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      );

    case 'bar':
      // Process bar chart data
      const barData = validatedConfig.data
        .filter(d => d[validatedConfig.xAxis!] !== null && d[validatedConfig.yAxis!] !== null)
        .map(d => ({
          ...d,
          [validatedConfig.yAxis!]: Number(d[validatedConfig.yAxis!])
        }))
        .filter(d => !isNaN(d[validatedConfig.yAxis!]) && isFinite(d[validatedConfig.yAxis!]));

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
            dataKey={validatedConfig.xAxis || 'x'}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(label) => `${validatedConfig.xAxis}: ${label}`}
            formatter={(value: any, name: string) => [Number(value).toFixed(2), validatedConfig.yAxis]}
          />
          <Legend />
          <Bar
            dataKey={validatedConfig.yAxis || 'y'}
            fill={COLORS[1]}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      );

    case 'scatter':
      // Ensure scatter plot has valid numeric data
      const scatterData = validatedConfig.data
        .filter(d => d[validatedConfig.xAxis!] !== null && d[validatedConfig.yAxis!] !== null)
        .map(d => ({
          ...d,
          [validatedConfig.xAxis!]: Number(d[validatedConfig.xAxis!]),
          [validatedConfig.yAxis!]: Number(d[validatedConfig.yAxis!])
        }))
        .filter(d => !isNaN(d[validatedConfig.xAxis!]) && !isNaN(d[validatedConfig.yAxis!]) && isFinite(d[validatedConfig.xAxis!]) && isFinite(d[validatedConfig.yAxis!]));

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
            dataKey={validatedConfig.xAxis || 'x'}
            type="number"
            tick={{ fontSize: 12 }}
            name={validatedConfig.xAxis}
          />
          <YAxis
            dataKey={validatedConfig.yAxis || 'y'}
            type="number"
            tick={{ fontSize: 12 }}
            name={validatedConfig.yAxis}
          />
          <Tooltip
            formatter={(value: any, name: string) => [Number(value).toFixed(2), name]}
            labelFormatter={(label) => `${validatedConfig.xAxis}: ${Number(label).toFixed(2)}`}
          />
          <Legend />
          <Scatter
            name={validatedConfig.yAxis}
            dataKey={validatedConfig.yAxis || 'y'}
            fill={COLORS[2]}
          />
        </ScatterChart>
      );

    case 'pie':
      // Process pie data to ensure valid numeric values
      const pieData = validatedConfig.data
        .slice(0, 10)
        .filter(d => d[validatedConfig.category!] !== null && d[validatedConfig.value!] !== null)
        .map(d => ({
          ...d,
          [validatedConfig.value!]: Number(d[validatedConfig.value!])
        }))
        .filter(d => !isNaN(d[validatedConfig.value!]) && isFinite(d[validatedConfig.value!]) && d[validatedConfig.value!] >= 0);

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
            dataKey={validatedConfig.value}
            nameKey={validatedConfig.category}
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
      // Process area chart data
      const areaData = validatedConfig.data
        .filter(d => d[validatedConfig.xAxis!] !== null && d[validatedConfig.yAxis!] !== null)
        .map(d => ({
          ...d,
          [validatedConfig.yAxis!]: Number(d[validatedConfig.yAxis!])
        }))
        .filter(d => !isNaN(d[validatedConfig.yAxis!]) && isFinite(d[validatedConfig.yAxis!]));

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
            dataKey={validatedConfig.xAxis || 'x'}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(label) => `${validatedConfig.xAxis}: ${label}`}
            formatter={(value: any, name: string) => [Number(value).toFixed(2), validatedConfig.yAxis]}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey={validatedConfig.yAxis || 'y'}
            stroke={COLORS[6]}
            fill={COLORS[6]}
            fillOpacity={0.6}
          />
        </AreaChart>
      );

    case 'treemap':
      const categoryField = validatedConfig.category || validatedConfig.hierarchyField || validatedConfig.xAxis;
      const valueField = validatedConfig.value || validatedConfig.yAxis;

      if (!categoryField || !valueField) {
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">Treemap requires category and value fields</p>
          </div>
        );
      }

      const treemapData = validatedConfig.data
        .filter(d => d[categoryField] !== null && d[valueField] !== null)
        .map((item, index) => ({
          name: String(item[categoryField]),
          size: Math.max(0, Number(item[valueField]) || 0),
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
      return <D3Histogram config={validatedConfig} />;

    case 'box_plot':
      return <D3BoxPlot config={validatedConfig} />;

    case 'heatmap':
      return <D3Heatmap config={validatedConfig} />;

    case 'sankey':
      return <D3Sankey config={validatedConfig} />;

    default:
      return (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">Chart type not yet supported</p>
        </div>
      );
  }
  } catch (error) {
    console.error('Error in renderChartForConfig:', error);
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">Error rendering chart</p>
      </div>
    );
  }
}