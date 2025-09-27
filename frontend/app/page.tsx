'use client';

import React from 'react';
import Link from 'next/link';
import {
  Brain,
  BarChart3,
  Database,
  Zap,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Users,
  TrendingUp,
  Palette
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Brain className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Auto Viz Agent</span>
            </div>
            <Link
              href="/canvas"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Launch App
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Brain className="h-16 w-16 text-blue-600" />
                <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-2 -right-2" />
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              AI-Powered Data
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                {" "}Visualization
              </span>
            </h1>

            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Transform your data into insights with our intelligent agentic AI platform.
              Upload datasets and let our AI agents automatically analyze, recommend, and create
              beautiful visualizations on an infinite canvas workspace.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/canvas"
                className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 text-lg font-semibold shadow-lg hover:shadow-xl"
              >
                <Palette className="h-5 w-5" />
                Get Started Free
                <ArrowRight className="h-5 w-5" />
              </Link>

              <button className="flex items-center gap-2 px-6 py-4 text-gray-600 hover:text-gray-800 transition-colors">
                <span>Watch Demo</span>
                <span className="text-2xl">▶️</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Intelligent Data Analysis Made Simple
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our multi-agent AI system automatically understands your data and provides
              intelligent recommendations for the best visualizations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Data Profiler Agent */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border border-blue-200">
              <div className="bg-blue-600 rounded-lg p-3 w-fit mb-4">
                <Database className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Data Profiler Agent</h3>
              <p className="text-gray-600 mb-4">
                Automatically analyzes your dataset structure, identifies data types,
                detects quality issues, and provides statistical summaries.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Column type detection
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Data quality assessment
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Statistical analysis
                </li>
              </ul>
            </div>

            {/* Pattern Recognition Agent */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-8 border border-purple-200">
              <div className="bg-purple-600 rounded-lg p-3 w-fit mb-4">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Pattern Recognition Agent</h3>
              <p className="text-gray-600 mb-4">
                Discovers hidden patterns, correlations, trends, and relationships
                within your data using advanced analytics.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Correlation detection
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Trend analysis
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Seasonality detection
                </li>
              </ul>
            </div>

            {/* Visualization Recommender Agent */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 border border-green-200">
              <div className="bg-green-600 rounded-lg p-3 w-fit mb-4">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Visualization Recommender</h3>
              <p className="text-gray-600 mb-4">
                Intelligently suggests the most effective chart types and configurations
                based on your data characteristics and patterns.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Smart chart recommendations
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Confidence scoring
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Justification explanations
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Canvas Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Infinite Canvas Workspace
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Work with your data and visualizations on a limitless canvas.
                Pan, zoom, and arrange elements freely to create the perfect
                analytical dashboard.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Drag and drop interface</span>
                </div>
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Infinite pan and zoom</span>
                </div>
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Real-time collaboration ready</span>
                </div>
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Multiple chart types</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border">
              <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center mb-4">
                <div className="text-center">
                  <Palette className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Interactive Canvas Preview</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-blue-100 rounded p-2 text-center">
                  <Database className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                  <span className="text-xs text-blue-600">Data</span>
                </div>
                <div className="bg-green-100 rounded p-2 text-center">
                  <BarChart3 className="h-4 w-4 text-green-600 mx-auto mb-1" />
                  <span className="text-xs text-green-600">Charts</span>
                </div>
                <div className="bg-purple-100 rounded p-2 text-center">
                  <TrendingUp className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                  <span className="text-xs text-purple-600">Analysis</span>
                </div>
                <div className="bg-yellow-100 rounded p-2 text-center">
                  <Users className="h-4 w-4 text-yellow-600 mx-auto mb-1" />
                  <span className="text-xs text-yellow-600">Share</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Data?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of data professionals using AI-powered visualization
            to unlock insights faster than ever before.
          </p>

          <Link
            href="/canvas"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-gray-50 transition-all duration-200 text-lg font-semibold shadow-lg hover:shadow-xl"
          >
            <Brain className="h-5 w-5" />
            Start Analyzing Now
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Brain className="h-6 w-6 text-blue-400" />
              <span className="text-lg font-semibold text-white">Auto Viz Agent</span>
            </div>
            <p className="text-gray-400">
              AI-powered data visualization platform • Built for modern data teams
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}