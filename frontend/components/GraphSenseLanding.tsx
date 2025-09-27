'use client';

import { Navigation } from "./Navigation";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { Architecture } from "./Architecture";
import { Team } from "./Team";

export default function GraphSenseLanding() {
  return (
    <div className="min-h-screen dark" style={{
      '--background': '#0A0A0A',
      '--foreground': '#FFFFFF',
      '--card': '#161616',
      '--card-foreground': '#FFFFFF',
      '--muted': '#262626',
      '--muted-foreground': '#A3A3A3',
      '--accent': '#4F46E5',
      '--accent-foreground': '#FFFFFF',
      '--border': '#262626'
    } as React.CSSProperties}>
      <div className="bg-background text-foreground">
        <Navigation />
        <main>
          <Hero />
          <Features />
          <Architecture />
          <Team />
        </main>
        
        <footer className="border-t border-border py-8">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <p className="text-muted-foreground font-mono text-sm">
              GraphSense - Built with ❤️ for VTHacks25
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
