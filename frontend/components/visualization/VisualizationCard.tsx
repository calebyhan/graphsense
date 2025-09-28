'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Settings, Maximize2, Copy, Trash2, MessageCircle, Link2, MoreHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter, AreaChart, Area } from 'recharts';

interface VisualizationCardProps {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'heatmap' | 'histogram' | 'box_plot' | 'treemap' | 'sankey';
  dataSource: string;
  lastUpdated: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isSelected?: boolean;
  onSelect: (id: string) => void;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onSizeChange: (id: string, size: { width: number; height: number }) => void;
  onDelete: (id: string) => void;
}


export function VisualizationCard({
  id,
  title,
  type,
  dataSource,
  lastUpdated,
  position,
  size,
  isSelected,
  onSelect,
  onPositionChange,
  onSizeChange,
  onDelete
}: VisualizationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showMenu, setShowMenu] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === cardRef.current || (e.target as Element).closest('.drag-handle')) {
      setIsDragging(true);
      const rect = cardRef.current?.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - (rect?.left || 0),
        y: e.clientY - (rect?.top || 0)
      });
      onSelect(id);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      onPositionChange(id, {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleTitleSubmit = () => {
    setIsEditing(false);
  };

  const renderChart = () => {
    const chartHeight = Math.max(200, size.height - 120); // Account for header and footer
    
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#4F46E5" 
                strokeWidth={2}
                dot={{ fill: '#4F46E5', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#4F46E5', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="region" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }} 
              />
              <Bar dataKey="sales" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={[]}
                cx="50%"
                cy="50%"
                outerRadius={Math.min(chartHeight / 3, 80)}
                dataKey="value"
                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {[].map((entry: any, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ScatterChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="x" stroke="#6B7280" fontSize={12} />
              <YAxis dataKey="y" stroke="#6B7280" fontSize={12} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter dataKey="z" fill="#4F46E5" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="sales" 
                stroke="#4F46E5" 
                fill="#4F46E5" 
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {type ? (type.charAt(0).toUpperCase() + type.slice(1)) : 'Chart'} Chart
          </div>
        );
    }
  };

  return (
    <motion.div
      className={`absolute ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height
      }}
      whileDrag={{ scale: 1.02 }}
      drag={false} // We handle dragging manually for better control
    >
      <Card 
        ref={cardRef}
        className="size-full flex flex-col glass-effect shadow-figma-lg hover:shadow-figma-xl transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
        onMouseDown={handleMouseDown}
        onClick={() => onSelect(id)}
      >
        {/* Title Bar */}
        <div className="drag-handle flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl cursor-move">
          <div className="flex items-center gap-2 flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') { setEditTitle(title); setIsEditing(false); }
                }}
                className="text-sm font-medium border-none outline-none bg-transparent flex-1 text-gray-900 dark:text-gray-100"
                autoFocus
              />
            ) : (
              <h3 
                className="text-sm font-medium cursor-text flex-1 text-gray-900 dark:text-gray-100"
                onDoubleClick={() => setIsEditing(true)}
              >
                {title}
              </h3>
            )}
            <Badge variant="secondary" className="text-xs">
              {type}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700">
              <MessageCircle className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Link2 className="w-3 h-3" />
            </Button>
            <div className="relative">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
              
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 glass-effect border border-gray-200 dark:border-gray-700 rounded-lg shadow-figma-lg z-50">
                  <div className="py-1">
                    <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Settings className="w-4 h-4" />
                      Chart settings
                    </button>
                    <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                    <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Maximize2 className="w-4 h-4" />
                      Fullscreen
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <button 
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(id);
                        setShowMenu(false);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 p-4 bg-white dark:bg-gray-800">
          {renderChart()}
        </div>

        {/* Info Strip */}
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Source: {dataSource}</span>
            <span>Updated {lastUpdated}</span>
          </div>
        </div>

        {/* Connection Nodes */}
        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-800 opacity-0 hover:opacity-100 transition-opacity cursor-crosshair" />
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-800 opacity-0 hover:opacity-100 transition-opacity cursor-crosshair" />
        <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-800 opacity-0 hover:opacity-100 transition-opacity cursor-crosshair" />
        <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-800 opacity-0 hover:opacity-100 transition-opacity cursor-crosshair" />

        {/* Resize Handles */}
        {isSelected && (
          <>
            <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-800 cursor-nw-resize" />
            <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-800 cursor-ne-resize" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-800 cursor-sw-resize" />
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-800 cursor-se-resize" />
          </>
        )}
      </Card>

      {/* Click outside to close menu */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowMenu(false)}
        />
      )}
    </motion.div>
  );
}
