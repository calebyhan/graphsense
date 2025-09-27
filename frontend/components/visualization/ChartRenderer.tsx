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

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const data = config.data.map(d => +d[config.yAxis!]);
    const bins = config.bins || 20;

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

    g.selectAll("rect")
      .data(binData)
      .enter().append("rect")
      .attr("x", d => x(d.x0!))
      .attr("y", d => y(d.length))
      .attr("width", d => Math.max(0, x(d.x1!) - x(d.x0!) - 1))
      .attr("height", d => height - y(d.length))
      .attr("fill", COLORS[4]);

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

    g.append("g")
      .call(d3.axisLeft(y));
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
      .call(d3.axisBottom(d3.scaleOrdinal().domain([config.yAxis!]).range([center])));

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

    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const xValues = [...new Set(config.data.map(d => d[config.xAxis!]))];
    const yValues = [...new Set(config.data.map(d => d[config.yAxis!]))];

    const x = d3.scaleBand()
      .domain(xValues)
      .range([0, width])
      .padding(0.1);

    const y = d3.scaleBand()
      .domain(yValues)
      .range([0, height])
      .padding(0.1);

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain(d3.extent(config.data, d => +d[config.value!]) as [number, number]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g.selectAll("rect")
      .data(config.data)
      .enter().append("rect")
      .attr("x", d => x(d[config.xAxis!])!)
      .attr("y", d => y(d[config.yAxis!])!)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", d => colorScale(+d[config.value!]));

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

    g.append("g")
      .call(d3.axisLeft(y));
  }, [config]);

  return <svg ref={svgRef} width={600} height={300} />;
};

const D3Sankey = ({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !config.data) return;

    // Simplified Sankey - would need d3-sankey for full implementation
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.append("text")
      .attr("x", 300)
      .attr("y", 150)
      .attr("text-anchor", "middle")
      .text("Sankey diagram requires specialized d3-sankey library");
  }, [config]);

  return <svg ref={svgRef} width={600} height={300} />;
};

export default function ChartRenderer({ config, chartType }: ChartRendererProps) {
  if (!config.data || config.data.length === 0) {
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
              dataKey={config.yAxis}
              stroke={COLORS[6]}
              fill={COLORS[6]}
              fillOpacity={0.6}
            />
          </AreaChart>
        );

      case 'treemap':
        // Prepare treemap data
        const treemapData = config.data.map((item, index) => ({
          name: item[config.category || config.xAxis!],
          size: +item[config.value || config.yAxis!],
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

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}