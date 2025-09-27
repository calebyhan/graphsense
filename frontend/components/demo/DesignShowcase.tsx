'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Palette, 
  Sun, 
  Moon, 
  Sparkles, 
  Check,
  Database,
  BarChart3,
  Zap
} from 'lucide-react';

interface DesignShowcaseProps {
  onClose?: ( ) => void;
}

export function DesignShowcase({ onClose }: DesignShowcaseProps) {
  const [isDark, setIsDark] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<'default' | 'secondary' | 'outline'>('default');

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-effect">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-indigo-600" />
                Figma Design Integration Showcase
              </CardTitle>
              <CardDescription>
                Demonstrating the new design system components and styling
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDark(!isDark)}
                className="h-8 w-8 p-0"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-8">
          {/* Color Palette */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Color Palette</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="w-full h-12 bg-indigo-600 rounded-lg"></div>
                <p className="text-sm text-center">Primary</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-12 bg-gray-100 dark:bg-gray-800 rounded-lg border"></div>
                <p className="text-sm text-center">Secondary</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-12 bg-green-500 rounded-lg"></div>
                <p className="text-sm text-center">Success</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-12 bg-red-500 rounded-lg"></div>
                <p className="text-sm text-center">Destructive</p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Button Variants</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="default" size="sm">Small</Button>
              <Button variant="default" size="lg">Large</Button>
            </div>
          </div>

          {/* Cards */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Card Components</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Database className="h-5 w-5 text-indigo-600" />
                  <div>
                    <h4 className="font-medium">Dataset Card</h4>
                    <p className="text-sm text-muted-foreground">Sales data Q4 2024</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">CSV</Badge>
                  <span className="text-xs text-muted-foreground">2.4 MB</span>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  <div>
                    <h4 className="font-medium">Chart Card</h4>
                    <p className="text-sm text-muted-foreground">Revenue trends</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="default">Line Chart</Badge>
                  <span className="text-xs text-muted-foreground">95% confidence</span>
                </div>
              </Card>
            </div>
          </div>

          {/* Form Elements */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Form Elements</h3>
            <div className="space-y-4 max-w-md">
              <Input placeholder="Enter your data..." />
              <div className="flex gap-2">
                <Input placeholder="Search..." className="flex-1" />
                <Button size="sm">
                  <Zap className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Badges & Status</h3>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Error</Badge>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <Check className="h-3 w-3 mr-1" />
                Success
              </Badge>
            </div>
          </div>

          {/* Glass Effect Demo */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Glass Morphism Effects</h3>
            <div className="relative p-8 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg">
              <Card className="glass-effect p-4 max-w-sm">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <div>
                    <h4 className="font-medium">Glass Effect Card</h4>
                    <p className="text-sm text-muted-foreground">
                      Backdrop blur with transparency
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Typography */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Typography Scale</h3>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Heading 1 - 2xl</h1>
              <h2 className="text-xl font-semibold">Heading 2 - xl</h2>
              <h3 className="text-lg font-medium">Heading 3 - lg</h3>
              <h4 className="text-base font-medium">Heading 4 - base</h4>
              <p className="text-sm">Body text - sm with proper line height and spacing</p>
              <p className="text-xs text-muted-foreground">Caption text - xs muted</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

