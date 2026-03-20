'use client';

import React, { useState, useRef, useEffect } from 'react';
import { StickyNote } from 'lucide-react';

interface NoteCardProps {
  initialContent?: string;
  color?: string;
  editable?: boolean;
  onUpdate?: (content: string, color: string) => void;
}

const NOTE_COLORS = [
  { value: '#fef08a', label: 'Yellow' },
  { value: '#bbf7d0', label: 'Green' },
  { value: '#bfdbfe', label: 'Blue' },
  { value: '#fecaca', label: 'Red' },
  { value: '#e9d5ff', label: 'Purple' },
];

export default function NoteCard({
  initialContent = '',
  color = '#fef08a',
  editable = true,
  onUpdate,
}: NoteCardProps) {
  const [content, setContent] = useState(initialContent);
  const [noteColor, setNoteColor] = useState(color);
  const [isEditing, setIsEditing] = useState(!initialContent && editable);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    onUpdate?.(content, noteColor);
  };

  const handleColorChange = (c: string) => {
    setNoteColor(c);
    onUpdate?.(content, c);
  };

  return (
    <div className="h-full flex flex-col rounded" style={{ backgroundColor: noteColor }}>
      <div className="flex items-center justify-between px-2 py-1 border-b border-black/10">
        <StickyNote className="h-3 w-3 text-gray-600 shrink-0" />
        {editable && (
          <div className="flex gap-1">
            {NOTE_COLORS.map(({ value, label }) => (
              <button
                key={value}
                title={label}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-transform hover:scale-110 ${
                  noteColor === value ? 'border-gray-700' : 'border-transparent'
                }`}
                style={{ backgroundColor: value }}
                onClick={() => handleColorChange(value)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 p-2 overflow-hidden">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-transparent resize-none outline-none text-sm text-gray-800 placeholder-gray-500/70 leading-relaxed"
            placeholder="Write a note..."
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditing(false);
                onUpdate?.(content, noteColor);
              }
            }}
          />
        ) : (
          <div
            className={`w-full h-full text-sm text-gray-800 whitespace-pre-wrap leading-relaxed overflow-auto ${
              editable ? 'cursor-text' : ''
            }`}
            onClick={() => editable && setIsEditing(true)}
          >
            {content || (
              <span className="text-gray-500/60 italic text-xs">Click to edit...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
