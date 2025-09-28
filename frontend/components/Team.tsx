'use client';

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ExternalLink, Github, FileText, Award } from "lucide-react";
import { motion } from "framer-motion";

export function Team() {
  const links = [
    {
      icon: Github,
      title: "GitHub Repository",
      description: "View the complete source code",
      href: "https://github.com/calebyhan/vthacks25"
    },
    {
      icon: ExternalLink,
      title: "Live Demo",
      description: "Try GraphSense in action",
      href: "htts://localhost:3000"
    },
    {
      icon: FileText,
      title: "Documentation",
      description: "Technical implementation details",
      href: "#"
    },
    {
      icon: Award,
      title: "DevPost Submission",
      description: "Official hackathon entry",
      href: "https://devpost.com/software/graphsense?ref_content=user-portfolio&ref_feature=in_progress"
    }
  ];

  const teamMembers = [
    "Hong Liu",
    "Caleb Han", 
    "Ethan Tran"
  ];

  const handleComingSoon = (feature: string) => {
    console.log(`TODO: ${feature} - coming soon`);
  };

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
        Built for VTHacks25
      </motion.h2>
      
      <div className="grid md:grid-cols-2 gap-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h3 className="text-xl text-white mb-6">Team</h3>
          <div className="flex flex-col gap-4">
            {teamMembers.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
              >
                <Card className="bg-card border-border">
                  <CardHeader className="py-4">
                    <CardTitle className="text-white text-lg font-medium">{member}</CardTitle>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
          
          <motion.div 
            className="mt-8 p-4 bg-card border border-border rounded-lg"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.7 }}
          >
            <p className="text-muted-foreground text-sm leading-relaxed">
              GraphSense was built in 48 hours by a team passionate about making data visualization 
              accessible through AI. We focused on creating intelligent agents that understand both 
              data patterns and visualization best practices.
            </p>
          </motion.div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h3 className="text-xl text-white mb-6">Project Links</h3>
          <div className="space-y-4">
            {links.map((link, index) => {
              const Icon = link.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                >
                  <Card className="bg-card border-border hover:border-accent/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center">
                            <Icon className="h-4 w-4 text-accent" />
                          </div>
                          <div>
                            <h4 className="text-white font-medium">{link.title}</h4>
                            <p className="text-muted-foreground text-sm">{link.description}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            if (link.href !== "#") {
                              window.open(link.href, '_blank');
                            } else {
                              handleComingSoon(link.title);
                            }
                          }}
                          className="inline-flex items-center justify-center size-9 rounded-md hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
