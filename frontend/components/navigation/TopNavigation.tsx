'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Download, History, Edit3, Bell, ChevronDown, Sun, Moon, Share2, Check, FileImage, FileText } from 'lucide-react';
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
  onExportCanvas?: (format: 'png' | 'pdf') => void;
  isExporting?: boolean;
}

function SaveIndicator({ saveState, lastSaved }: { saveState: SaveState; lastSaved: Date | null }) {
  const [, setTick] = useState(0);

  // Re-render every minute so relative time stays fresh — only while showing saved state
  useEffect(() => {
    if (saveState !== 'saved' || !lastSaved) return;
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [saveState, lastSaved]);

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
    const diffMin = Math.max(0, Math.floor(diffMs / 60_000));
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

export function TopNavigation({ isDarkMode, onToggleDarkMode, isTransitioning = false, canvasId, isOwner, saveState = 'idle', lastSaved = null, onExportCanvas, isExporting = false }: TopNavigationProps) {
  const [projectName, setProjectName] = useState('GraphSense');
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const [shareOpen, setShareOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExportMenu]);

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
        {onExportCanvas && (
          <div className="relative" ref={exportMenuRef}>
            <Button
              variant="outline"
              disabled={isExporting}
              onClick={() => setShowExportMenu(v => !v)}
              className="hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 transition-all duration-300 cursor-pointer"
            >
              {isExporting ? (
                <span className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>

            {showExportMenu && !isExporting && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999] p-1.5 canvas-export-ignore">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 px-2 pt-1">
                  Export Canvas
                </div>
                <button
                  type="button"
                  onClick={() => { setShowExportMenu(false); onExportCanvas('png'); }}
                  className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  <FileImage className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">PNG Image</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">High-quality raster</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowExportMenu(false); onExportCanvas('pdf'); }}
                  className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">PDF Document</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Portable document</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

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
