'use client';

import React, { useState, useEffect } from 'react';
import { Download, History, Edit3, Bell, ChevronDown, Sun, Moon, Share2, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import BackendStatusChecker from '@/components/canvas/BackendStatusChecker';
import CollaboratorAvatarStack from '@/components/canvas/CollaboratorAvatarStack';
import { ShareDialog } from '@/components/canvas/ShareDialog';
type SaveState = 'idle' | 'saving' | 'saved';

interface TopNavigationProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isTransitioning?: boolean;
  canvasId?: string;
  isOwner?: boolean;
  saveState?: SaveState;
  lastSaved?: Date | null;
}

function SaveIndicator({ saveState, lastSaved }: { saveState: SaveState; lastSaved: Date | null }) {
  const [, setTick] = useState(0);

  // Re-render every minute so relative time stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (saveState === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        Saving…
      </span>
    );
  }

  if (saveState === 'saved' && lastSaved) {
    const diffMs = Date.now() - lastSaved.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const label = diffMin < 1 ? 'just now' : `${diffMin}m ago`;
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <Check className="w-3 h-3 text-green-500" />
        Saved {label}
      </span>
    );
  }

  return null;
}

export function TopNavigation({ isDarkMode, onToggleDarkMode, isTransitioning = false, canvasId, isOwner, saveState = 'idle', lastSaved = null }: TopNavigationProps) {
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
            <Image src="/favicon.ico" alt="Logo" width={48} height={48} className="cursor-pointer hover:opacity-80 transition-opacity" />
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
          <SaveIndicator saveState={saveState} lastSaved={lastSaved} />
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
