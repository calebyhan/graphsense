'use client';

import React from 'react';
import { Database, Info } from 'lucide-react';

interface DatasetCardProps {
  data: any[];
  dataProfile?: any;
  title?: string;
}

export default function DatasetCard({ data, dataProfile, title = "Dataset" }: DatasetCardProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Database className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const displayData = data.slice(0, 5); // Show fewer rows for canvas
  const columns = Object.keys(data[0]).slice(0, 4); // Show fewer columns for canvas

  const getColumnType = (columnName: string) => {
    const profile = dataProfile?.columns.find((col: any) => col.name === columnName);
    return profile?.type || 'text';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'numeric':
        return 'bg-blue-100 text-blue-800';
      case 'categorical':
        return 'bg-green-100 text-green-800';
      case 'temporal':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Database className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <span className="text-xs text-gray-500">
          ({data.length} rows)
        </span>
      </div>

      {/* Data Quality Info */}
      {dataProfile && (
        <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3 text-gray-500" />
            <span className="text-gray-600">
              Quality: <span className="capitalize font-medium">{dataProfile.dataQuality}</span>
            </span>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-2 py-1 text-left font-medium text-gray-500 border-b"
                >
                  <div className="flex flex-col gap-1">
                    <span className="truncate max-w-20" title={column}>
                      {column}
                    </span>
                    <span
                      className={`inline-flex px-1 py-0.5 text-xs rounded ${getTypeColor(getColumnType(column))}`}
                    >
                      {getColumnType(column)}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td
                    key={column}
                    className="px-2 py-1 text-gray-900 border-b"
                  >
                    <div className="max-w-20 truncate" title={String(row[column])}>
                      {row[column] !== null && row[column] !== undefined
                        ? String(row[column])
                        : <span className="text-gray-400 italic">null</span>
                      }
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {data.length > 5 && (
        <div className="mt-2 text-center">
          <p className="text-xs text-gray-500">
            +{data.length - 5} more rows
          </p>
        </div>
      )}
    </div>
  );
}