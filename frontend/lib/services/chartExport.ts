/**
 * Chart Export Service
 * Handles exporting charts to PNG, SVG, and PDF formats
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type ExportFormat = 'png' | 'svg' | 'pdf';

export interface ExportOptions {
  filename?: string;
  width?: number;
  height?: number;
  quality?: number;
  backgroundColor?: string;
}

export class ChartExportService {
  /**
   * Export a chart element to the specified format
   */
  static async exportChart(
    element: HTMLElement,
    format: ExportFormat,
    options: ExportOptions = {}
  ): Promise<void> {
    const {
      filename = `chart_${Date.now()}`,
      width = 800,
      height = 600,
      quality = 1.0,
      backgroundColor = '#ffffff'
    } = options;

    try {
      switch (format) {
        case 'png':
          await this.exportToPNG(element, filename, { width, height, quality, backgroundColor });
          break;
        case 'svg':
          await this.exportToSVG(element, filename);
          break;
        case 'pdf':
          await this.exportToPDF(element, filename, { width, height, backgroundColor });
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Chart export failed:', error);
      throw new Error(`Failed to export chart as ${format.toUpperCase()}`);
    }
  }

  /**
   * Export chart to PNG format
   */
  private static async exportToPNG(
    element: HTMLElement,
    filename: string,
    options: { width: number; height: number; quality: number; backgroundColor: string }
  ): Promise<void> {
    const canvas = await html2canvas(element, {
      width: options.width,
      height: options.height,
      scale: options.quality,
      backgroundColor: options.backgroundColor,
      useCORS: true,
      allowTaint: true,
      logging: false
    });

    // Convert to blob and download
    canvas.toBlob((blob) => {
      if (blob) {
        this.downloadBlob(blob, `${filename}.png`);
      }
    }, 'image/png', options.quality);
  }

  /**
   * Export chart to SVG format
   */
  private static async exportToSVG(element: HTMLElement, filename: string): Promise<void> {
    // Find SVG element within the chart
    const svgElement = element.querySelector('svg');

    if (!svgElement) {
      throw new Error('No SVG element found in the chart');
    }

    // Clone the SVG to avoid modifying the original
    const clonedSVG = svgElement.cloneNode(true) as SVGElement;

    // Add XML namespace if not present
    if (!clonedSVG.getAttribute('xmlns')) {
      clonedSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    // Convert to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSVG);

    // Create blob and download
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    this.downloadBlob(blob, `${filename}.svg`);
  }

  /**
   * Export chart to PDF format
   */
  private static async exportToPDF(
    element: HTMLElement,
    filename: string,
    options: { width: number; height: number; backgroundColor: string }
  ): Promise<void> {
    const canvas = await html2canvas(element, {
      width: options.width,
      height: options.height,
      scale: 2, // Higher scale for better quality in PDF
      backgroundColor: options.backgroundColor,
      useCORS: true,
      allowTaint: true,
      logging: false
    });

    // Create PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: options.width > options.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [options.width, options.height]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, options.width, options.height);
    pdf.save(`${filename}.pdf`);
  }

  /**
   * Download a blob as a file
   */
  private static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get recommended export dimensions based on chart type
   */
  static getRecommendedDimensions(chartType: string): { width: number; height: number } {
    const dimensionsMap: Record<string, { width: number; height: number }> = {
      bar: { width: 800, height: 600 },
      line: { width: 1000, height: 600 },
      scatter: { width: 800, height: 600 },
      pie: { width: 600, height: 600 },
      histogram: { width: 800, height: 600 },
      box_plot: { width: 800, height: 600 },
      heatmap: { width: 800, height: 800 },
      area: { width: 1000, height: 600 },
      treemap: { width: 800, height: 600 },
      sankey: { width: 1000, height: 700 }
    };

    return dimensionsMap[chartType] || { width: 800, height: 600 };
  }

  /**
   * Validate if an element can be exported
   */
  static canExport(element: HTMLElement): boolean {
    if (!element) return false;

    // Check if element has content
    const hasContent = element.children.length > 0 || element.textContent?.trim();

    // Check if element is visible
    const style = window.getComputedStyle(element);
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden';

    return Boolean(hasContent && isVisible);
  }
}