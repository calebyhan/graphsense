'use client';

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { BarChart3, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export function Features() {
  const features = [
    {
      icon: () => <img src="/favicon.ico" alt="GraphSense" className="h-6 w-6 rounded-sm" />,
      title: "Multi-Agent AI",
      description: "3 specialized agents work together to analyze, recommend, and validate visualizations"
    },
    {
      icon: BarChart3,
      title: "10 Chart Types", 
      description: "Comprehensive analysis of all major chart types to find the perfect match"
    },
    {
      icon: MessageSquare,
      title: "Transparent Reasoning",
      description: "Every recommendation comes with clear explanations of why it was chosen"
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
        Intelligent Visualization, Explained
      </motion.h2>
      
      <div className="grid md:grid-cols-3 gap-8">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
            >
              <Card className="bg-card border-border h-full">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle className="text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
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
