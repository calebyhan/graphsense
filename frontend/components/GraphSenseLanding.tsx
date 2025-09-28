'use client';

import React from "react";
import { Navigation } from "./Navigation";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { Architecture } from "./Architecture";
import { Team } from "./Team";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";

export default function GraphSenseLanding() {
  return (
    <div
      className="min-h-screen dark"
      style={
        {
          "--background": "#0A0A0A",
          "--foreground": "#FFFFFF",
          "--card": "#161616",
          "--card-foreground": "#FFFFFF",
          "--muted": "#262626",
          "--muted-foreground": "#A3A3A3",
          "--accent": "#4F46E5",
          "--accent-foreground": "#FFFFFF",
          "--border": "#262626",
        } as React.CSSProperties
      }
    >
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        {/* Full-page animated grid */}
        <AnimatedGridPattern
          className="absolute inset-x-0 inset-y-[-30%] h-[200%] skew-y-12 opacity-20 transform-gpu"
          width={60}
          height={60}
          numSquares={150}
          maxOpacity={0.1}
          duration={1.2}
          repeatDelay={1}
        />
        
        {/* Page content */}
        <div className="relative z-10">
          <Navigation />
          <main>
            <Hero />
            <Features />
            <Architecture />
            <Team />
          </main>
          <footer className="border-t border-border py-8">
            <div className="mx-auto max-w-6xl px-6 text-center">
              <p className="font-mono text-sm text-muted-foreground">
                GraphSense — Built with ❤️ for VTHacks25
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
