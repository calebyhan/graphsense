'use client';

import { useAnalysisStore } from '@/store/useAnalysisStore';
import { Database, Info } from 'lucide-react';

export default function DataPreview() {
  const { rawData, dataProfile } = useAnalysisStore();

  if (!rawData || rawData.length === 0) {
    return null;
  }

  const displayData = rawData.slice(0, 10);
  const columns = Object.keys(rawData[0]);

  const getColumnType = (columnName: string) => {
    const profile = dataProfile?.columns.find(col => col.name === columnName);
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Database className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">
          Data Preview
        </h3>
        <span className="text-sm text-gray-500">
          ({rawData.length} rows, {columns.length} columns)
        </span>
      </div>

      {dataProfile && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">Dataset Quality</p>
              <p className="text-sm text-gray-600">
                Data quality: <span className="capitalize font-medium">{dataProfile.dataQuality}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <div className="flex flex-col gap-1">
                    <span className="truncate max-w-32" title={column}>
                      {column}
                    </span>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(getColumnType(column))}`}
                    >
                      {getColumnType(column)}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td
                    key={column}
                    className="px-3 py-2 whitespace-nowrap text-sm text-gray-900"
                  >
                    <div className="max-w-32 truncate" title={String(row[column])}>
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

      {rawData.length > 10 && (
        <div className="mt-3 text-center">
          <p className="text-sm text-gray-500">
            Showing first 10 rows of {rawData.length} total rows
          </p>
        </div>
      )}
    </div>
  );
}