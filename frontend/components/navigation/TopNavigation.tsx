'use client';

import React, { useState } from 'react';
import { Download, History, Edit3, Bell, ChevronDown, Sun, Moon, Share2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BackendStatusChecker from '@/components/canvas/BackendStatusChecker';
import CollaboratorAvatarStack from '@/components/canvas/CollaboratorAvatarStack';
import { ShareDialog } from '@/components/canvas/ShareDialog';
interface TopNavigationProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isTransitioning?: boolean;
  canvasId?: string;
  isOwner?: boolean;
}

export function TopNavigation({ isDarkMode, onToggleDarkMode, isTransitioning = false, canvasId, isOwner }: TopNavigationProps) {
  const [projectName, setProjectName] = useState('GraphSense');
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const [shareOpen, setShareOpen] = useState(false);

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
          <Link href="/dashboard">
            <img src="/favicon.ico" alt="Logo" className="h-12 w-12 cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
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
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110 rounded transition-all duration-300 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Auto-saved
          </Badge>
          <BackendStatusChecker />
        </div>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2">
        {/* Collaborator avatars */}
        {canvasId && <CollaboratorAvatarStack />}

        {/* Dark Mode Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleDarkMode}
          disabled={isTransitioning}
          className={`h-8 w-8 p-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 transition-all duration-300 cursor-pointer ${
            isTransitioning ? 'opacity-70 pointer-events-none' : ''
          }`}
        >
          {isTransitioning ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : isDarkMode ? (
            <Sun className="w-4 h-4 text-yellow-500" />
          ) : (
            <Moon className="w-4 h-4 text-gray-600" />
          )}
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="sm"
          className="relative hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 transition-all duration-300 cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        {/* Version History */}
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 transition-all duration-300 cursor-pointer"
        >
          <History className="w-4 h-4" />
        </Button>

        {/* Export Options */}
        <div className="relative">
          <Button
            variant="outline"
            className="hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 transition-all duration-300 cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {/* Share button — owners only */}
        {isOwner && canvasId && (
          <>
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <ShareDialog canvasId={canvasId} isOpen={shareOpen} onClose={() => setShareOpen(false)} />
          </>
        )}

      </div>
    </div>
  );
}
