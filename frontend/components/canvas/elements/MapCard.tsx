'use client';

import React, { useState, useMemo } from 'react';
import { Map, MapPin, Globe, Layers } from 'lucide-react';

interface MapCardProps {
  data: any[];
  title?: string;
  config?: {
    latField?: string;
    lngField?: string;
    locationField?: string;
    valueField?: string;
    colorField?: string;
    mapType?: 'scatter' | 'choropleth' | 'heat';
  };
}

interface DataPoint {
  lat?: number;
  lng?: number;
  location?: string;
  value?: number;
  color?: string;
  [key: string]: any;
}

export default function MapCard({
  data,
  title = 'Map Visualization',
  config = {}
}: MapCardProps) {
  const [mapType, setMapType] = useState<'scatter' | 'choropleth' | 'heat'>(config.mapType || 'scatter');
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);

  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((row, index) => {
      const point: DataPoint = { ...row };

      // Try to extract coordinates
      if (config.latField && config.lngField) {
        point.lat = parseFloat(row[config.latField]);
        point.lng = parseFloat(row[config.lngField]);
      } else {
        // Try common lat/lng field names
        const latFields = ['lat', 'latitude', 'y', 'lat_col'];
        const lngFields = ['lng', 'lon', 'longitude', 'x', 'lng_col'];

        const latField = latFields.find(field => row[field] !== undefined);
        const lngField = lngFields.find(field => row[field] !== undefined);

        if (latField && lngField) {
          point.lat = parseFloat(row[latField]);
          point.lng = parseFloat(row[lngField]);
        }
      }

      // Extract other fields
      if (config.valueField) {
        point.value = parseFloat(row[config.valueField]) || 0;
      }

      if (config.colorField) {
        point.color = row[config.colorField];
      }

      if (config.locationField) {
        point.location = row[config.locationField];
      }

      return point;
    }).filter(point => point.lat !== undefined && point.lng !== undefined && !isNaN(point.lat) && !isNaN(point.lng));
  }, [data, config]);

  const bounds = useMemo(() => {
    if (processedData.length === 0) return null;

    const lats = processedData.map(p => p.lat!);
    const lngs = processedData.map(p => p.lng!);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [processedData]);

  const getPointPosition = (point: DataPoint) => {
    if (!bounds) return { x: 0, y: 0 };

    const x = ((point.lng! - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    const y = ((bounds.maxLat - point.lat!) / (bounds.maxLat - bounds.minLat)) * 100;

    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const getPointColor = (point: DataPoint) => {
    if (point.color) {
      // If it's a number, use a color scale
      if (typeof point.color === 'number') {
        const intensity = Math.min(1, Math.max(0, point.color / 100));
        return `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`;
      }
      // If it's a string, use predefined colors
      const colorMap: Record<string, string> = {
        'red': '#ef4444',
        'blue': '#3b82f6',
        'green': '#22c55e',
        'yellow': '#eab308',
        'purple': '#a855f7',
        'orange': '#f97316',
        'pink': '#ec4899',
        'teal': '#14b8a6',
      };
      return colorMap[point.color.toLowerCase()] || '#6b7280';
    }

    if (point.value !== undefined) {
      const maxValue = Math.max(...processedData.map(p => p.value || 0));
      const intensity = point.value / maxValue;
      return `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`;
    }

    return '#3b82f6';
  };

  const getPointSize = (point: DataPoint) => {
    if (point.value !== undefined) {
      const maxValue = Math.max(...processedData.map(p => p.value || 0));
      const minValue = Math.min(...processedData.map(p => p.value || 0));
      const normalized = (point.value - minValue) / (maxValue - minValue);
      return 4 + normalized * 8; // Size between 4px and 12px
    }
    return 6;
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Map className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Globe className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No location data available</p>
          </div>
        </div>
      </div>
    );
  }

  if (processedData.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Map className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No valid coordinates found</p>
            <p className="text-xs text-gray-400 mt-1">
              Looking for lat/lng, latitude/longitude, or x/y fields
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-gray-900">{title}</span>
          <span className="text-xs text-gray-500">
            ({processedData.length} points)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMapType('scatter')}
            className={`p-1 rounded text-xs ${mapType === 'scatter' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
            title="Scatter map"
          >
            <MapPin className="h-3 w-3" />
          </button>
          <button
            onClick={() => setMapType('heat')}
            className={`p-1 rounded text-xs ${mapType === 'heat' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
            title="Heat map"
          >
            <Layers className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Map Visualization */}
      <div className="flex-1 relative bg-gray-100 rounded border overflow-hidden">
        {/* Simple world map background */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-100 to-green-100 opacity-30" />

        {/* Grid lines for reference */}
        <div className="absolute inset-0">
          {[...Array(5)].map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute w-full border-t border-gray-300 opacity-20"
              style={{ top: `${(i + 1) * 20}%` }}
            />
          ))}
          {[...Array(5)].map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute h-full border-l border-gray-300 opacity-20"
              style={{ left: `${(i + 1) * 20}%` }}
            />
          ))}
        </div>

        {/* Data points */}
        <div className="absolute inset-0">
          {processedData.map((point, index) => {
            const { x, y } = getPointPosition(point);
            return (
              <div
                key={index}
                className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-125"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${getPointSize(point)}px`,
                  height: `${getPointSize(point)}px`,
                  backgroundColor: getPointColor(point),
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.8)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
                onClick={() => setSelectedPoint(point)}
                title={`${point.location || `${point.lat}, ${point.lng}`}${point.value !== undefined ? ` - ${point.value}` : ''}`}
              />
            );
          })}
        </div>

        {/* Bounds info */}
        <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs text-gray-600">
          {bounds && (
            <div>
              <div>Lat: {bounds.minLat.toFixed(2)} to {bounds.maxLat.toFixed(2)}</div>
              <div>Lng: {bounds.minLng.toFixed(2)} to {bounds.maxLng.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Selected point info */}
      {selectedPoint && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
          <div className="font-medium text-blue-900 mb-1">
            {selectedPoint.location || `${selectedPoint.lat}, ${selectedPoint.lng}`}
          </div>
          {selectedPoint.value !== undefined && (
            <div className="text-blue-800">Value: {selectedPoint.value}</div>
          )}
          {Object.entries(selectedPoint)
            .filter(([key]) => !['lat', 'lng', 'location', 'value', 'color'].includes(key))
            .slice(0, 3)
            .map(([key, value]) => (
              <div key={key} className="text-blue-700">
                {key}: {String(value)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}