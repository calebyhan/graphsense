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
import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
import * as d3 from 'd3';
import { useChartPerformance } from '@/hooks/usePerformance';
import { PerformanceIndicator } from '@/components/common/PerformanceIndicator';

type ChartType = 'line' | 'bar' | 'column' | 'scatter' | 'pie' | 'histogram' | 'box_plot' | 'heatmap' | 'area' | 'treemap' | 'sankey';

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

// Shared hook: observe a container div and return its pixel dimensions.
// Defaults to 600×300 until the first ResizeObserver callback fires.
const useChartDimensions = (containerRef: React.RefObject<HTMLDivElement | null>) => {
  const [dimensions, setDimensions] = useState({ width: 600, height: 300 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(200, Math.floor(width)),
        height: Math.max(150, Math.floor(height)),
      });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  return dimensions;
};

// Shared helper: create a styled tooltip div attached to a container.
// Removes any prior tooltip from the same container first.
function createD3Tooltip(container: HTMLDivElement | null) {
  if (!container) return null;
  d3.select(container).selectAll('.d3-tooltip').remove();
  return d3.select(container)
    .append('div')
    .attr('class', 'd3-tooltip')
    .style('position', 'absolute')
    .style('background', 'rgba(17,24,39,0.92)')
    .style('color', '#fff')
    .style('padding', '8px 12px')
    .style('border-radius', '6px')
    .style('font-size', '12px')
    .style('line-height', '1.5')
    .style('pointer-events', 'none')
    .style('opacity', '0')
    .style('z-index', '1000')
    .style('white-space', 'nowrap');
}

// D3.js Chart Components
const D3Histogram = memo(({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth, height: containerHeight } = useChartDimensions(containerRef);

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
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.bottom - margin.top;

    const { data: numericData } = processedData;

    if (numericData.length === 0) {
      svg.append("text")
        .attr("x", containerWidth / 2)
        .attr("y", containerHeight / 2)
        .attr("text-anchor", "middle")
        .text("No valid numeric data for histogram");
      return () => {};
    }

    const tooltip = createD3Tooltip(containerRef.current);

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
      .attr("cursor", "pointer")
      .on("mouseover", function(event, d) {
        if (!tooltip) return;
        const [mx, my] = d3.pointer(event, containerRef.current);
        tooltip.style("opacity", "1")
          .html(`<b>${processedData.valueField}:</b> ${d.x0?.toFixed(2)} – ${d.x1?.toFixed(2)}<br/><b>Count:</b> ${d.length}`)
          .style("left", `${mx + 12}px`)
          .style("top", `${my - 44}px`);
      })
      .on("mousemove", function(event) {
        if (!tooltip) return;
        const [mx, my] = d3.pointer(event, containerRef.current);
        tooltip.style("left", `${mx + 12}px`).style("top", `${my - 44}px`);
      })
      .on("mouseout", function() { tooltip?.style("opacity", "0"); });

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

    return () => { d3.select(containerRef.current).selectAll('.d3-tooltip').remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedData, containerWidth, containerHeight]);

  if (!processedData) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">No valid numeric data for histogram</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} width={containerWidth} height={containerHeight} />
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
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth, height: containerHeight } = useChartDimensions(containerRef);

  useEffect(() => {
    if (!svgRef.current || !config.data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.bottom - margin.top;

    let yAxisField = config.value || config.yAxis;
    if (!yAxisField && config.data && config.data.length > 0) {
      const dataKeys = Object.keys(config.data[0]);
      yAxisField = dataKeys.find(key => {
        const sampleValues = config.data.slice(0, 10).map(row => row[key]);
        const numericValues = sampleValues.filter(val => !isNaN(Number(val)) && val !== null && val !== '');
        return numericValues.length > sampleValues.length * 0.7;
      });
    }

    if (!yAxisField) {
      console.warn('[D3BoxPlot] Could not resolve yAxisField from config:', {
        value: config.value, yAxis: config.yAxis,
        availableKeys: config.data?.length ? Object.keys(config.data[0]) : [],
      });
      svg.append("text")
        .attr("x", containerWidth / 2).attr("y", containerHeight / 2)
        .attr("text-anchor", "middle")
        .text("Box plot requires a numeric value field");
      return () => {};
    }

    const tooltip = createD3Tooltip(containerRef.current);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const drawBox = (
      g: d3.Selection<SVGGElement, unknown, null, undefined>,
      values: number[],
      cx: number,
      boxW: number,
      y: d3.ScaleLinear<number, number>,
      color: string,
      label?: string
    ) => {
      const sorted = [...values].sort(d3.ascending);
      const q1 = d3.quantile(sorted, 0.25)!;
      const median = d3.quantile(sorted, 0.5)!;
      const q3 = d3.quantile(sorted, 0.75)!;
      const iqr = q3 - q1;
      const whiskerMin = Math.max(d3.min(sorted)!, q1 - 1.5 * iqr);
      const whiskerMax = Math.min(d3.max(sorted)!, q3 + 1.5 * iqr);

      const tooltipHtml = (label ? `<b>${label}</b><br/>` : '') +
        `<b>Min:</b> ${whiskerMin.toFixed(2)}<br/>` +
        `<b>Q1:</b> ${q1.toFixed(2)}<br/>` +
        `<b>Median:</b> ${median.toFixed(2)}<br/>` +
        `<b>Q3:</b> ${q3.toFixed(2)}<br/>` +
        `<b>Max:</b> ${whiskerMax.toFixed(2)}`;

      g.append("rect")
        .attr("x", cx - boxW / 2)
        .attr("y", y(q3))
        .attr("width", boxW)
        .attr("height", Math.max(1, y(q1) - y(q3)))
        .attr("fill", color)
        .attr("opacity", 0.7)
        .attr("cursor", "pointer")
        .on("mouseover", function(event) {
          if (!tooltip) return;
          const [mx, my] = d3.pointer(event, containerRef.current);
          tooltip.style("opacity", "1").html(tooltipHtml)
            .style("left", `${mx + 12}px`).style("top", `${my - 20}px`);
        })
        .on("mousemove", function(event) {
          if (!tooltip) return;
          const [mx, my] = d3.pointer(event, containerRef.current);
          tooltip.style("left", `${mx + 12}px`).style("top", `${my - 20}px`);
        })
        .on("mouseout", function() { tooltip?.style("opacity", "0"); });

      g.append("line")
        .attr("x1", cx - boxW / 2).attr("x2", cx + boxW / 2)
        .attr("y1", y(median)).attr("y2", y(median))
        .attr("stroke", "black").attr("stroke-width", 2);

      g.append("line")
        .attr("x1", cx).attr("x2", cx)
        .attr("y1", y(whiskerMin)).attr("y2", y(q1))
        .attr("stroke", "black");

      g.append("line")
        .attr("x1", cx).attr("x2", cx)
        .attr("y1", y(whiskerMax)).attr("y2", y(q3))
        .attr("stroke", "black");

      // Whisker caps
      g.append("line")
        .attr("x1", cx - boxW / 4).attr("x2", cx + boxW / 4)
        .attr("y1", y(whiskerMin)).attr("y2", y(whiskerMin))
        .attr("stroke", "black");

      g.append("line")
        .attr("x1", cx - boxW / 4).attr("x2", cx + boxW / 4)
        .attr("y1", y(whiskerMax)).attr("y2", y(whiskerMax))
        .attr("stroke", "black");
    };

    const categoryField = config.category;

    if (categoryField) {
      // Grouped box plot: one box per category
      const sourceData = config.data.length > 5000
        ? sampleData(config.data, 5000, 'box_plot')
        : config.data;

      const grouped = d3.group(sourceData, (d: any) => String(d[categoryField]));
      const categories = Array.from(grouped.keys()).sort();

      const allValues = sourceData
        .map((d: any) => +d[yAxisField!])
        .filter((v: number) => !isNaN(v));

      if (allValues.length === 0) {
        svg.append("text")
          .attr("x", containerWidth / 2)
          .attr("y", containerHeight / 2)
          .attr("text-anchor", "middle")
          .text("No valid numeric data for box plot");
        return;
      }

      const iqrAll = d3.quantile([...allValues].sort(d3.ascending), 0.75)! -
                     d3.quantile([...allValues].sort(d3.ascending), 0.25)!;
      const yMin = Math.max(d3.min(allValues)!, d3.quantile([...allValues].sort(d3.ascending), 0.25)! - 1.5 * iqrAll);
      const yMax = Math.min(d3.max(allValues)!, d3.quantile([...allValues].sort(d3.ascending), 0.75)! + 1.5 * iqrAll);

      const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([height, 0]);
      const xBand = d3.scaleBand().domain(categories).range([0, width]).padding(0.3);

      let boxesDrawn = 0;
      categories.forEach((cat, i) => {
        const vals = (grouped.get(cat) || [])
          .map((d: any) => +d[yAxisField!])
          .filter((v: number) => !isNaN(v));
        if (vals.length < 4) return;
        boxesDrawn++;
        drawBox(g, vals, xBand(cat)! + xBand.bandwidth() / 2, xBand.bandwidth() * 0.7, y, COLORS[i % COLORS.length], cat);
      });

      if (boxesDrawn === 0) {
        svg.append("text")
          .attr("x", containerWidth / 2)
          .attr("y", containerHeight / 2 - 10)
          .attr("text-anchor", "middle")
          .attr("font-size", "14px")
          .text("Insufficient data for box plot");
        svg.append("text")
          .attr("x", containerWidth / 2)
          .attr("y", containerHeight / 2 + 14)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("fill", "#6b7280")
          .text("Each group needs at least 4 data points");
        return;
      }

      g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xBand));
      g.append("g").call(d3.axisLeft(y));
    } else {
      // Single box plot
      const values = config.data
        .map((d: any) => +d[yAxisField!])
        .filter((v: number) => !isNaN(v));
      if (values.length === 0) {
        svg.append("text")
          .attr("x", containerWidth / 2).attr("y", containerHeight / 2)
          .attr("text-anchor", "middle")
          .text("No valid numeric data for box plot");
        return () => { d3.select(containerRef.current).selectAll('.d3-tooltip').remove(); };
      }

      const iqrVal = d3.quantile([...values].sort(d3.ascending), 0.75)! -
                     d3.quantile([...values].sort(d3.ascending), 0.25)!;
      const yMin = Math.max(d3.min(values)!, d3.quantile([...values].sort(d3.ascending), 0.25)! - 1.5 * iqrVal);
      const yMax = Math.min(d3.max(values)!, d3.quantile([...values].sort(d3.ascending), 0.75)! + 1.5 * iqrVal);

      const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([height, 0]);
      const boxWidth = Math.min(60, width * 0.3);

      drawBox(g, values, width / 2, boxWidth, y, COLORS[5], yAxisField);

      g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(d3.scaleBand().domain([yAxisField!]).range([width / 2 - 50, width / 2 + 50])));

      g.append("g").call(d3.axisLeft(y));
    }

    return () => { d3.select(containerRef.current).selectAll('.d3-tooltip').remove(); };
  }, [config, containerWidth, containerHeight]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} width={containerWidth} height={containerHeight} />
    </div>
  );
};

const D3Heatmap = ({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth, height: containerHeight } = useChartDimensions(containerRef);

  useEffect(() => {
    if (!svgRef.current || !config.data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const tooltip = createD3Tooltip(containerRef.current);

    const margin = { top: 50, right: 80, bottom: 50, left: 80 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.bottom - margin.top;

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
        .attr("x", containerWidth / 2)
        .attr("y", containerHeight / 2)
        .attr("text-anchor", "middle")
        .text("Heatmap requires row, column, and value fields");
      return () => {};
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
          .attr("cursor", "pointer")
          .on("mouseover", function(event) {
            if (!tooltip) return;
            const [mx, my] = d3.pointer(event, containerRef.current);
            tooltip.style("opacity", "1")
              .html(`<b>${xField}:</b> ${xVal}<br/><b>${yField}:</b> ${yVal}<br/><b>${valueField}:</b> ${Number(value).toLocaleString()}`)
              .style("left", `${mx + 12}px`).style("top", `${my - 44}px`);
          })
          .on("mousemove", function(event) {
            if (!tooltip) return;
            const [mx, my] = d3.pointer(event, containerRef.current);
            tooltip.style("left", `${mx + 12}px`).style("top", `${my - 44}px`);
          })
          .on("mouseout", function() { tooltip?.style("opacity", "0"); });
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

    return () => { d3.select(containerRef.current).selectAll('.d3-tooltip').remove(); };
  }, [config, containerWidth, containerHeight]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} width={containerWidth} height={containerHeight} />
    </div>
  );
};

const D3Sankey = ({ config }: { config: ChartConfig }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth, height: containerHeight } = useChartDimensions(containerRef);

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
      if (svgRef.current) {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
        svg.append("text")
          .attr("x", containerWidth / 2).attr("y", containerHeight / 2)
          .attr("text-anchor", "middle")
          .text("Sankey requires source and target fields");
      }
      return () => {};
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const tooltip = createD3Tooltip(containerRef.current);

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.bottom - margin.top;

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

    const showNodeTooltip = (event: MouseEvent, name: string, role: string) => {
      if (!tooltip) return;
      const total = links
        .filter(l => l.source === name || l.target === name)
        .reduce((sum, l) => sum + l.value, 0);
      const [mx, my] = d3.pointer(event, containerRef.current);
      tooltip.style("opacity", "1")
        .html(`<b>${name}</b><br/>${role}<br/><b>Total flow:</b> ${total.toLocaleString()}`)
        .style("left", `${mx + 12}px`).style("top", `${my - 44}px`);
    };

    sourceNodes.forEach((node, i) => {
      const y = (height / sourceNodes.length) * i + 5;
      g.append("rect")
        .attr("x", 50)
        .attr("y", y)
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("fill", COLORS[i % COLORS.length])
        .attr("cursor", "pointer")
        .on("mouseover", (e) => showNodeTooltip(e, node.name, "Source"))
        .on("mousemove", (e) => {
          if (!tooltip) return;
          const [mx, my] = d3.pointer(e, containerRef.current);
          tooltip.style("left", `${mx + 12}px`).style("top", `${my - 44}px`);
        })
        .on("mouseout", () => tooltip?.style("opacity", "0"));

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
        .attr("fill", COLORS[i % COLORS.length])
        .attr("cursor", "pointer")
        .on("mouseover", (e) => showNodeTooltip(e, node.name, "Target"))
        .on("mousemove", (e) => {
          if (!tooltip) return;
          const [mx, my] = d3.pointer(e, containerRef.current);
          tooltip.style("left", `${mx + 12}px`).style("top", `${my - 44}px`);
        })
        .on("mouseout", () => tooltip?.style("opacity", "0"));

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
          .attr("opacity", 0.6)
          .attr("cursor", "pointer")
          .on("mouseover", function(event) {
            if (!tooltip) return;
            const [mx, my] = d3.pointer(event, containerRef.current);
            tooltip.style("opacity", "1")
              .html(`<b>${link.source}</b> → <b>${link.target}</b><br/><b>Value:</b> ${link.value.toLocaleString()}`)
              .style("left", `${mx + 12}px`).style("top", `${my - 44}px`);
          })
          .on("mousemove", function(event) {
            if (!tooltip) return;
            const [mx, my] = d3.pointer(event, containerRef.current);
            tooltip.style("left", `${mx + 12}px`).style("top", `${my - 44}px`);
          })
          .on("mouseout", function() { tooltip?.style("opacity", "0"); });
      }
    });

    return () => { d3.select(containerRef.current).selectAll('.d3-tooltip').remove(); };
  }, [config, containerWidth, containerHeight]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} width={containerWidth} height={containerHeight} />
    </div>
  );
};

class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ChartRenderer] Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg border-2 border-dashed border-red-300">
          <div className="text-center">
            <p className="text-red-600 font-medium">Chart failed to render</p>
            <p className="text-xs text-red-400 mt-1">{this.state.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    if (!processedConfig) return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">Unable to process chart data</p>
      </div>
    );
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

        // Process line chart data: aggregate by xAxis (GROUP BY + SUM), then sort
        const lineAggMap = new Map<string, number>();
        (processedConfig.data || []).forEach((d: any) => {
          const key = String(d[lineXField!] ?? '');
          if (!key) return;
          lineAggMap.set(key, (lineAggMap.get(key) || 0) + (+d[lineYField!] || 0));
        });
        const lineData = Array.from(lineAggMap.entries())
          .filter(([k]) => k !== '')
          .sort((a, b) => {
            const na = Number(a[0]), nb = Number(b[0]);
            return !isNaN(na) && !isNaN(nb) ? na - nb : a[0].localeCompare(b[0]);
          })
          .map(([key, val]) => ({ [lineXField!]: key, [lineYField!]: val }));

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
            <YAxis tick={{ fontSize: 12 }} width={80} />
            <Tooltip
              labelFormatter={(label) => `${lineXField}: ${label}`}
              formatter={(value: any, _name: string) => [Number(value).toFixed(2), lineYField]}
              wrapperStyle={{ zIndex: 100 }}
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

    case 'column':
    case 'bar':
      // category/value are the correct params for bar charts (not xAxis/yAxis)
      let barXField = processedConfig.category || processedConfig.xAxis || processedConfig.chartSpecificConfig?.xAxis;
      let barYField = processedConfig.value || processedConfig.yAxis || processedConfig.chartSpecificConfig?.yAxis;

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

      // Aggregate by category (GROUP BY barXField, SUM barYField)
      {
        const barAggMap = new Map<string, number>();
        (processedConfig.data || []).forEach((d: any) => {
          const key = String(d[barXField!] ?? '');
          if (!key) return;
          barAggMap.set(key, (barAggMap.get(key) || 0) + (+d[barYField!] || 0));
        });
        const barData = Array.from(barAggMap.entries())
          .filter(([k]) => k !== '')
          .sort((a, b) => b[1] - a[1])
          .slice(0, 30)
          .map(([key, val]) => ({ [barXField!]: key, [barYField!]: val }));

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
            <YAxis tick={{ fontSize: 12 }} width={80} />
            <Tooltip
              labelFormatter={(label) => `${barXField}: ${label}`}
              formatter={(value: any, _name: string) => [Number(value).toLocaleString(), barYField]}
              wrapperStyle={{ zIndex: 100 }}
            />
            <Legend />
            <Bar
              dataKey={barYField || 'y'}
              fill={COLORS[1]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );
      }

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
        <ScatterChart>
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
            width={80}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value: any, name: string) => [Number(value).toFixed(2), name]}
            wrapperStyle={{ zIndex: 100 }}
          />
          <Legend />
          <Scatter
            name={scatterYField}
            data={scatterData}
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
      
      // Process pie data: aggregate by category (GROUP BY + SUM), sort descending, cap at 10
      const PIE_MAX_SLICES = 10;
      const pieAggMap = new Map<string, number>();
      (processedConfig.data || []).forEach((d: any) => {
        const key = String(d[pieCategoryField!] ?? '');
        if (!key) return;
        const val = Number(d[pieValueField!]);
        if (!isNaN(val) && isFinite(val) && val >= 0) {
          pieAggMap.set(key, (pieAggMap.get(key) || 0) + val);
        }
      });
      const allPieData = Array.from(pieAggMap.entries())
        .filter(([k]) => k !== '')
        .sort((a, b) => b[1] - a[1])
        .map(([key, val]) => ({ [pieCategoryField!]: key, [pieValueField!]: val }));

      const topSlices = allPieData.slice(0, PIE_MAX_SLICES);
      const overflow = allPieData.slice(PIE_MAX_SLICES);
      if (overflow.length > 0) {
        const otherValue = overflow.reduce((sum: number, d: any) => sum + d[pieValueField!], 0);
        if (otherValue > 0) {
          const otherLabel = `Other (${overflow.length} more)`;
          topSlices.push({ [pieCategoryField!]: otherLabel, [pieValueField!]: otherValue });
        }
      }
      const pieData = topSlices;

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
            outerRadius="70%"
            label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, name: string) => [Number(value).toFixed(2), name]}
            wrapperStyle={{ zIndex: 100 }}
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
      
      // Process area chart data: aggregate by xAxis (GROUP BY + SUM), then sort
      const areaAggMap = new Map<string, number>();
      (processedConfig.data || []).forEach((d: any) => {
        const key = String(d[areaXField!] ?? '');
        if (!key) return;
        areaAggMap.set(key, (areaAggMap.get(key) || 0) + (+d[areaYField!] || 0));
      });
      const areaData = Array.from(areaAggMap.entries())
        .filter(([k]) => k !== '')
        .sort((a, b) => {
          const na = Number(a[0]), nb = Number(b[0]);
          return !isNaN(na) && !isNaN(nb) ? na - nb : a[0].localeCompare(b[0]);
        })
        .map(([key, val]) => ({ [areaXField!]: key, [areaYField!]: val }));

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
          <YAxis tick={{ fontSize: 12 }} width={80} />
          <Tooltip
            labelFormatter={(label) => `${areaXField}: ${label}`}
            formatter={(value: any, _name: string) => [Number(value).toFixed(2), areaYField]}
            wrapperStyle={{ zIndex: 100 }}
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

      // Aggregate by category (GROUP BY + SUM) before building treemap nodes
      const treemapAggMap = new Map<string, number>();
      (processedConfig.data || []).forEach((d: any) => {
        const key = String(d[treemapCategoryField!] ?? '');
        if (!key) return;
        const val = Number(d[treemapValueField!]);
        if (!isNaN(val) && isFinite(val)) {
          treemapAggMap.set(key, (treemapAggMap.get(key) || 0) + val);
        }
      });
      const treemapData = Array.from(treemapAggMap.entries())
        .filter(([k, v]) => k !== '' && v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([key, val], index) => ({
          name: key,
          size: val,
          fill: COLORS[index % COLORS.length]
        }));

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
        >
          <Tooltip
            formatter={(value: any) => [Number(value).toLocaleString(), treemapValueField || 'Value']}
            contentStyle={{ background: 'rgba(17,24,39,0.92)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#fff', fontWeight: 'bold' }}
            wrapperStyle={{ zIndex: 100 }}
          />
        </Treemap>
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
      <div className="w-full h-full flex flex-col">
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

        <div className="flex-1 flex items-center justify-center overflow-visible">
          <ChartErrorBoundary>{renderChart()}</ChartErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
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

      <div className="flex-1 relative min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ChartErrorBoundary>{renderChart()}</ChartErrorBoundary>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default ChartRenderer;