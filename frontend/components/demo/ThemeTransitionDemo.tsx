'use client';

import React from 'react';
import { useThemeTransition } from '@/hooks/useThemeTransition';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeTransitionDemo() {
  const { isDarkMode, isTransitioning, toggleTheme } = useThemeTransition();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={toggleTheme}
        disabled={isTransitioning}
        className={`p-3 rounded-full shadow-lg transition-all duration-300 ${
          isTransitioning ? 'opacity-70 scale-95' : 'hover:scale-110'
        }`}
      >
        {isTransitioning ? (
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isDarkMode ? (
          <Sun className="w-6 h-6 text-yellow-500" />
        ) : (
          <Moon className="w-6 h-6 text-blue-600" />
        )}
      </Button>
    </div>
  );
}
