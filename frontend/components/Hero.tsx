'use client';

import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Play } from "lucide-react";
import { motion } from "framer-motion";

export function Hero() {
  const techStack = ["Next.js", "Python", "FastAPI", "Google Gemini", "Docker"];

  const handleTryDemo = () => {
    window.location.href = '/canvas';
  };

  return (
    <motion.section 
      className="max-w-4xl mx-auto px-6 py-20 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.h1 
        className="text-5xl md:text-6xl font-mono text-white mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        GraphSense
      </motion.h1>
      
      <motion.h2 
        className="text-2xl md:text-3xl text-accent mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        AI-Powered Data Visualization Agent
      </motion.h2>
      
      <motion.p 
        className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        Upload any dataset. Our multi-agent AI pipeline analyzes your data and automatically generates 
        the perfect visualizations with transparent reasoning.
      </motion.p>
      
      <motion.div 
        className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <Button 
          size="lg" 
          className="bg-accent hover:bg-accent/90 hover:scale-105 text-white transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl"
          onClick={handleTryDemo}
        >
          <Play className="h-5 w-5 mr-2" />
          Try Demo
        </Button>
      </motion.div>
      
      <motion.div 
        className="flex flex-wrap gap-2 justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        {techStack.map((tech, index) => (
          <motion.div
            key={tech}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
          >
            <Badge 
              variant="secondary" 
              className="font-mono text-sm bg-card text-card-foreground border border-border"
            >
              {tech}
            </Badge>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}
