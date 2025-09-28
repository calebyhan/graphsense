'use client';

import React, { useState } from 'react';
import { Share, Download, History, Users, Settings, Edit3, Bell, ChevronDown, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TopNavigationProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function TopNavigation({ isDarkMode, onToggleDarkMode }: TopNavigationProps) {
  const [projectName, setProjectName] = useState('Auto Viz Analysis');
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(projectName);

  const handleNameSubmit = () => {
    setProjectName(tempName);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setTempName(projectName);
      setIsEditing(false);
    }
  };

  return (
    <div className="h-14 glass-effect border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 shadow-figma z-10">
      {/* Left Section - Project Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <img src="/favicon.ico" alt="Logo" className="h-12 w-12" />
          <div className="flex items-center gap-2">
            {isEditing ? (
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleKeyPress}
                className="text-lg font-semibold border-none outline-none focus:outline-none bg-transparent max-w-xs text-gray-900 dark:text-gray-100"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-2">
                <h1 
                  className="text-lg font-semibold cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-gray-900 dark:text-gray-100"
                  onClick={() => setIsEditing(true)}
                >
                  {projectName}
                </h1>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <Edit3 className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        <Badge variant="secondary" className="text-xs">
          Auto-saved
        </Badge>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2">
        {/* Dark Mode Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleDarkMode}
          className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-yellow-500" />
          ) : (
            <Moon className="w-4 h-4 text-gray-600" />
          )}
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-4 h-4" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        {/* Version History */}
        <Button variant="ghost" size="sm">
          <History className="w-4 h-4" />
        </Button>

        {/* Share Button */}
        <div className="relative">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Share className="w-4 h-4 mr-2" />
            Share
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {/* Export Options */}
        <div className="relative">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
