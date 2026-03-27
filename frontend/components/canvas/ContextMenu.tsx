'use client';

import React, { useEffect, useRef } from 'react';
import {
  MousePointer,
  Hand,
  BarChart3,
  Database,
  Table,
  Type,
  Map,
  StickyNote,
  Maximize,
  Crosshair,
  Trash2,
  Copy,
  Clipboard,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore, ToolType } from '@/store/useCanvasStore';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  /** null = canvas background, string = element id */
  elementId: string | null;
  /** canvas-space coords for placing elements on background right-click */
  canvasX?: number;
  canvasY?: number;
}

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onCopyElements: () => void;
  onPasteElements: () => void;
  hasClipboard: boolean;
  onPlaceElement: (tool: ToolType, canvasX: number, canvasY: number) => void;
  onFitToScreen: () => void;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

function MenuItem({ icon, label, shortcut, onClick, danger, disabled }: MenuItemProps) {
  return (
    <button
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-md transition-colors text-left',
        disabled
          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          : danger
          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
      )}
      onClick={disabled ? undefined : onClick}
    >
      <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">{shortcut}</span>
      )}
    </button>
  );
}

function Separator() {
  return <div className="my-1 border-t border-gray-200 dark:border-gray-700" />;
}

const PLACEMENT_TOOLS: { tool: ToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { tool: 'chart',   label: 'Add Chart',   icon: <BarChart3 className="w-4 h-4" />,   shortcut: 'C' },
  { tool: 'dataset', label: 'Add Dataset', icon: <Database className="w-4 h-4" />,    shortcut: 'D' },
  { tool: 'table',   label: 'Add Table',   icon: <Table className="w-4 h-4" />,       shortcut: 'T' },
  { tool: 'text',    label: 'Add Text',    icon: <Type className="w-4 h-4" />,        shortcut: '⇧T' },
  { tool: 'map',     label: 'Add Map',     icon: <Map className="w-4 h-4" />,         shortcut: 'M' },
  { tool: 'note',    label: 'Add Note',    icon: <StickyNote className="w-4 h-4" />,  shortcut: 'N' },
];

export default function ContextMenu({
  state,
  onClose,
  onDeleteElement,
  onDuplicateElement,
  onCopyElements,
  onPasteElements,
  hasClipboard,
  onPlaceElement,
  onFitToScreen,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { setSelectedTool, resetViewport, bringForward, sendBackward, bringToFront, sendToBack } = useCanvasStore();

  // Close on outside click or Escape
  useEffect(() => {
    if (!state.visible) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [state.visible, onClose]);

  // Nudge menu into viewport so it never clips off-screen
  const menuWidth = 220;
  const menuHeight = state.elementId ? 260 : 340;
  const left = Math.min(state.x, window.innerWidth - menuWidth - 8);
  const top = Math.min(state.y, window.innerHeight - menuHeight - 8);

  if (!state.visible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] w-[220px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-figma-xl p-1.5 animate-fade-in"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.elementId ? (
        /* ── Element context menu ── */
        <>
          <MenuItem
            icon={<Copy className="w-4 h-4" />}
            label="Copy"
            shortcut="⌘C"
            onClick={() => { onCopyElements(); onClose(); }}
          />
          <MenuItem
            icon={<Copy className="w-4 h-4" />}
            label="Duplicate"
            shortcut="⌘D"
            onClick={() => { onDuplicateElement(state.elementId!); onClose(); }}
          />
          <Separator />
          <MenuItem
            icon={<ArrowUp className="w-4 h-4" />}
            label="Bring Forward"
            onClick={() => { bringForward(state.elementId!); onClose(); }}
          />
          <MenuItem
            icon={<ArrowDown className="w-4 h-4" />}
            label="Send Backward"
            onClick={() => { sendBackward(state.elementId!); onClose(); }}
          />
          <MenuItem
            icon={<ChevronsUp className="w-4 h-4" />}
            label="Bring to Front"
            onClick={() => { bringToFront(state.elementId!); onClose(); }}
          />
          <MenuItem
            icon={<ChevronsDown className="w-4 h-4" />}
            label="Send to Back"
            onClick={() => { sendToBack(state.elementId!); onClose(); }}
          />
          <Separator />
          <MenuItem
            icon={<Download className="w-4 h-4" />}
            label="Export as PNG"
            disabled
            onClick={onClose}
          />
          <Separator />
          <MenuItem
            icon={<Trash2 className="w-4 h-4" />}
            label="Delete"
            shortcut="⌫"
            danger
            onClick={() => { onDeleteElement(state.elementId!); onClose(); }}
          />
        </>
      ) : (
        /* ── Canvas background context menu ── */
        <>
          <MenuItem
            icon={<Clipboard className="w-4 h-4" />}
            label="Paste"
            shortcut="⌘V"
            disabled={!hasClipboard}
            onClick={() => { onPasteElements(); onClose(); }}
          />
          <Separator />
          <MenuItem
            icon={<MousePointer className="w-4 h-4" />}
            label="Select"
            shortcut="V"
            onClick={() => { setSelectedTool('pointer'); onClose(); }}
          />
          <MenuItem
            icon={<Hand className="w-4 h-4" />}
            label="Hand"
            shortcut="H"
            onClick={() => { setSelectedTool('drag'); onClose(); }}
          />
          <Separator />
          {PLACEMENT_TOOLS.map(({ tool, label, icon, shortcut }) => (
            <MenuItem
              key={tool}
              icon={icon}
              label={label}
              shortcut={shortcut}
              onClick={() => {
                onPlaceElement(tool, state.canvasX ?? 0, state.canvasY ?? 0);
                onClose();
              }}
            />
          ))}
          <Separator />
          <MenuItem
            icon={<Maximize className="w-4 h-4" />}
            label="Fit to Screen"
            shortcut="F"
            onClick={() => { onFitToScreen(); onClose(); }}
          />
          <MenuItem
            icon={<Crosshair className="w-4 h-4" />}
            label="Go to Origin"
            shortcut="Space"
            onClick={() => { resetViewport(); onClose(); }}
          />
        </>
      )}
    </div>
  );
}
