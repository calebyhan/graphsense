'use client';

import { useState, useEffect } from 'react';

export function useThemeTransition() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const toggleTheme = () => {
    if (isTransitioning) return; // Prevent rapid toggling during transition
    
    setIsTransitioning(true);
    
    // Add transition class to document
    document.documentElement.classList.add('theme-transitioning');
    
    // Toggle the theme
    setIsDarkMode(prev => !prev);
    
    // Remove transition class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
      setIsTransitioning(false);
    }, 400); // Match the CSS transition duration
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return {
    isDarkMode,
    isTransitioning,
    toggleTheme
  };
}
