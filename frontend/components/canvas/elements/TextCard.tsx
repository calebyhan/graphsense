'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Type, Bold, Italic, List, Link2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface TextCardProps {
  initialContent?: string;
  title?: string;
  editable?: boolean;
}

export default function TextCard({
  initialContent = '',
  title = 'Text Block',
  editable = true
}: TextCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [fontSize, setFontSize] = useState('14');
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(content.length, content.length);
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
  };

  const handleCancel = () => {
    setContent(initialContent);
    setIsEditing(false);
  };

  const formatText = (format: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let formattedText = '';
    let newContent = content;

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        newContent = content.substring(0, start) + formattedText + content.substring(end);
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        newContent = content.substring(0, start) + formattedText + content.substring(end);
        break;
      case 'list':
        const lines = selectedText.split('\n');
        formattedText = lines.map(line => line.trim() ? `• ${line.trim()}` : line).join('\n');
        newContent = content.substring(0, start) + formattedText + content.substring(end);
        break;
      case 'link':
        formattedText = `[${selectedText || 'Link text'}](https://example.com)`;
        newContent = content.substring(0, start) + formattedText + content.substring(end);
        break;
    }

    setContent(newContent);

    // Restore selection
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = start + formattedText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering
    let html = text
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic text
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-500 underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Lists
      .replace(/^• (.+)$/gm, '<li class="ml-4">$1</li>')
      // Line breaks
      .replace(/\n/g, '<br>');

    // Wrap list items
    html = html.replace(/(<li.*?<\/li>)/g, (match) => {
      if (!match.includes('<ul>')) {
        return `<ul class="list-disc list-inside">${match}</ul>`;
      }
      return match;
    });

    return html;
  };

  if (!content && !isEditing && editable) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Type className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>
        <div
          className="flex-1 flex items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-50 rounded border-2 border-dashed border-gray-300"
          onClick={() => setIsEditing(true)}
        >
          <div className="text-center">
            <Type className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Click to add text</p>
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
          <Type className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>

        {editable && (
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* Formatting toolbar */}
      {isEditing && (
        <div className="mb-3 p-2 bg-gray-50 rounded border">
          <div className="flex items-center gap-1 mb-2">
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              className="text-xs border border-gray-300 rounded px-1 py-0.5"
            >
              <option value="12">12px</option>
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
              <option value="20">20px</option>
              <option value="24">24px</option>
            </select>

            <div className="w-px h-4 bg-gray-300 mx-1" />

            <button
              onClick={() => setAlignment('left')}
              className={`p-1 rounded ${alignment === 'left' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
              title="Align left"
            >
              <AlignLeft className="h-3 w-3" />
            </button>
            <button
              onClick={() => setAlignment('center')}
              className={`p-1 rounded ${alignment === 'center' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
              title="Align center"
            >
              <AlignCenter className="h-3 w-3" />
            </button>
            <button
              onClick={() => setAlignment('right')}
              className={`p-1 rounded ${alignment === 'right' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
              title="Align right"
            >
              <AlignRight className="h-3 w-3" />
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1" />

            <button
              onClick={() => formatText('bold')}
              className="p-1 rounded hover:bg-gray-100"
              title="Bold (Ctrl+B)"
            >
              <Bold className="h-3 w-3" />
            </button>
            <button
              onClick={() => formatText('italic')}
              className="p-1 rounded hover:bg-gray-100"
              title="Italic (Ctrl+I)"
            >
              <Italic className="h-3 w-3" />
            </button>
            <button
              onClick={() => formatText('list')}
              className="p-1 rounded hover:bg-gray-100"
              title="Bullet list"
            >
              <List className="h-3 w-3" />
            </button>
            <button
              onClick={() => formatText('link')}
              className="p-1 rounded hover:bg-gray-100"
              title="Link"
            >
              <Link2 className="h-3 w-3" />
            </button>
          </div>

          <div className="text-xs text-gray-500">
            Use **bold**, *italic*, [link](url), and • for lists
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full p-3 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Start typing... Use **bold**, *italic*, [links](url), and • for lists"
            style={{
              fontSize: `${fontSize}px`,
              textAlign: alignment,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleSave();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
          />
        ) : (
          <div
            ref={contentRef}
            className={`h-full p-3 text-gray-900 overflow-auto ${editable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            style={{
              fontSize: `${fontSize}px`,
              textAlign: alignment,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal'
            }}
            onClick={() => editable && setIsEditing(true)}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>

      {/* Character count */}
      {isEditing && (
        <div className="mt-2 pt-2 border-t text-xs text-gray-500 text-right">
          {content.length} characters
        </div>
      )}
    </div>
  );
}