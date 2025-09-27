'use client';

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Layers, Server, Cpu, Database } from "lucide-react";
import { motion } from "framer-motion";

export function Architecture() {
  const components = [
    {
      icon: Layers,
      title: "Frontend",
      tech: "Next.js/React",
      description: "Modern React interface with drag-and-drop data upload"
    },
    {
      icon: Server,
      title: "Backend", 
      tech: "FastAPI/Python",
      description: "High-performance API handling data processing and agent coordination"
    },
    {
      icon: Cpu,
      title: "AI Pipeline",
      tech: "Google Gemini",
      description: "Multi-agent system for intelligent visualization recommendations"
    },
    {
      icon: Database,
      title: "Database",
      tech: "Supabase", 
      description: "Real-time data storage and user session management"
    }
  ];

  return (
    <motion.section 
      className="max-w-6xl mx-auto px-6 py-20"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <motion.h2 
        className="text-3xl font-mono text-center text-white mb-12"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        How We Built It
      </motion.h2>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {components.map((component, index) => {
          const Icon = component.icon;
          return (
            <motion.div 
              key={index} 
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
            >
              <Card className="bg-card border-border w-full h-full">
                <CardHeader className="text-center">
                  <div className="h-12 w-12 rounded-lg bg-accent/20 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle className="text-white text-lg">{component.title}</CardTitle>
                  <p className="text-accent font-mono text-sm">{component.tech}</p>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground text-sm">
                    {component.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
