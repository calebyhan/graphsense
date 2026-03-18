'use client';

import { Github } from "lucide-react";

export function Navigation() {
  const handleGitHub = () => {
    window.open('https://github.com/calebyhan/graphsense', '_blank');
  };

  return (
    <nav className="w-full px-6 py-4 flex items-center justify-between">
      <div className="flex items-center">
        <h1 className="text-xl font-mono text-white">GraphSense</h1>
      </div>
      
      <button 
        onClick={handleGitHub}
        className="inline-flex items-center gap-2 h-8 rounded-md px-3 border border-accent text-accent hover:bg-accent/10 hover:scale-105 hover:border-accent/80 text-sm font-medium transition-all duration-200 cursor-pointer"
      >
        <Github className="h-4 w-4" />
        View on GitHub
      </button>
    </nav>
  );
}
