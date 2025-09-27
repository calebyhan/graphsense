'use client';

import React, { useState, useMemo } from 'react';
import { Table, ChevronUp, ChevronDown, Search, Filter } from 'lucide-react';

interface TableCardProps {
  data: any[];
  title?: string;
  maxRows?: number;
}

export default function TableCard({ data, title = 'Data Table', maxRows = 50 }: TableCardProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];

    let processedData = [...data];

    // Apply filter
    if (filterText) {
      processedData = processedData.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(filterText.toLowerCase())
        )
      );
    }

    // Apply sort
    if (sortColumn) {
      processedData.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        if (aVal === bVal) return 0;

        const result = aVal < bVal ? -1 : 1;
        return sortDirection === 'asc' ? result : -result;
      });
    }

    return processedData;
  }, [data, filterText, sortColumn, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = currentPage * maxRows;
    return filteredAndSortedData.slice(startIndex, startIndex + maxRows);
  }, [filteredAndSortedData, currentPage, maxRows]);

  const totalPages = Math.ceil(filteredAndSortedData.length / maxRows);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }
    return String(value);
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Table className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Table className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No data available</p>
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
          <Table className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-900">{title}</span>
          <span className="text-xs text-gray-500">
            ({filteredAndSortedData.length} rows)
          </span>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="p-1 hover:bg-gray-100 rounded"
          title="Toggle filters"
        >
          <Filter className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-3 p-2 bg-gray-50 rounded border">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search all columns..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto border border-gray-200 rounded">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-2 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 border-b"
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate">{column}</span>
                    {sortColumn === column && (
                      sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3" /> :
                        <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50 border-b border-gray-100">
                {columns.map((column) => (
                  <td key={column} className="px-2 py-2 text-gray-900 border-r border-gray-100 last:border-r-0">
                    <div className="truncate max-w-32" title={formatCellValue(row[column])}>
                      {formatCellValue(row[column])}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
          <span className="text-gray-500">
            Page {currentPage + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="px-2 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="px-2 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}