/**
 * Chart Export Service
 * Handles exporting charts to PNG, SVG, and PDF formats, and the full canvas.
 *
 * Uses html-to-image instead of html2canvas because html2canvas 1.4.1 cannot
 * parse oklch() CSS colors (used by Tailwind v4). html-to-image delegates
 * rendering to the browser's native engine via SVG foreignObject, which supports
 * all modern CSS including oklch.
 */

import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useCanvasStore } from '@/store/useCanvasStore';

export type ExportFormat = 'png' | 'svg' | 'pdf';

interface CanvasElementBounds {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface ExportOptions {
  filename?: string;
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
      quality = 1.0,
      backgroundColor = '#ffffff'
    } = options;

    try {
      switch (format) {
        case 'png':
          await this.exportToPNG(element, filename, { quality, backgroundColor });
          break;
        case 'svg':
          await this.exportToSVG(element, filename);
          break;
        case 'pdf':
          await this.exportToPDF(element, filename, { backgroundColor });
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
   * Capture a canvas element by:
   * 1. Directly manipulating the CSS transform on the canvas content div (bypassing
   *    React's render cycle to guarantee the transform is applied before capture).
   * 2. Capturing the full canvas root with html-to-image (same approach as exportFullCanvas).
   * 3. Cropping the result to the element's on-screen bounding box via Canvas 2D.
   *
   * This avoids the html-to-image viewport-clipping issue that occurs when capturing
   * elements nested inside CSS-transformed ancestors.
   */
  private static async captureElement(
    element: HTMLElement,
    backgroundColor: string,
    pixelRatio = 2
  ): Promise<string> {
    const store = useCanvasStore.getState();

    // Find the CanvasElement wrapper to get world-space position from the store
    const wrapper = element.closest('[data-element-id]') as HTMLElement | null;
    const elementId = wrapper?.getAttribute('data-element-id');
    const canvasEl = elementId ? store.canvasElements.find(e => e.id === elementId) : null;

    const canvasRoot = document.querySelector<HTMLElement>('[data-canvas-root]');
    const canvasContent = document.querySelector<HTMLElement>('[data-canvas-content]');

    if (canvasEl && canvasRoot && canvasContent) {
      // Fixed zoom=1 so export quality is independent of the current viewport zoom.
      const CAPTURE_ZOOM = 1.0;
      const cW = canvasRoot.clientWidth;
      const cH = canvasRoot.clientHeight;
      const worldCx = canvasEl.position.x + canvasEl.size.width / 2;
      const worldCy = canvasEl.position.y + canvasEl.size.height / 2;

      // Directly set the CSS transform — matches InfiniteCanvas's format exactly,
      // bypassing the React render cycle so the DOM update is guaranteed before capture.
      const savedTransform = canvasContent.style.transform;
      canvasContent.style.transform =
        `translate(${cW / 2}px, ${cH / 2}px) translate(${-worldCx * CAPTURE_ZOOM}px, ${-worldCy * CAPTURE_ZOOM}px) scale(${CAPTURE_ZOOM})`;

      // Two rAFs ensure the browser has flushed both style recalculation and layout
      // before we call getBoundingClientRect() and capture.
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      try {
        // Element screen bounds are valid now that the transform is applied.
        const elemRect = element.getBoundingClientRect();
        const rootRect = canvasRoot.getBoundingClientRect();

        // Clamp to canvas root bounds so we don't crop outside the captured area.
        const srcLeft = Math.max(0, elemRect.left - rootRect.left);
        const srcTop  = Math.max(0, elemRect.top  - rootRect.top);
        const srcRight  = Math.min(rootRect.width,  elemRect.right  - rootRect.left);
        const srcBottom = Math.min(rootRect.height, elemRect.bottom - rootRect.top);

        // Capture the full canvas root (no CSS-transform ancestry issues).
        const fullDataUrl = await htmlToImage.toPng(canvasRoot, {
          quality: 1.0,
          backgroundColor,
          pixelRatio,
          filter: (el) => {
            const cl = el.classList;
            if (!cl) return true;
            return !cl.contains('export-ignore') &&
                   !cl.contains('canvas-export-ignore') &&
                   !cl.contains('canvas-grid');
          },
        });

        // Load the full capture and crop to the element area.
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = fullDataUrl;
        });

        // Floor the origin and ceil the far edge so sub-pixel BoundingClientRect
        // values don't truncate the canvas dimensions or leave hairline gaps.
        const rawX = srcLeft  * pixelRatio;
        const rawY = srcTop   * pixelRatio;
        const cropX = Math.floor(rawX);
        const cropY = Math.floor(rawY);
        const cropW = Math.max(1, Math.ceil(srcRight  * pixelRatio) - cropX);
        const cropH = Math.max(1, Math.ceil(srcBottom * pixelRatio) - cropY);

        const offscreen = document.createElement('canvas');
        offscreen.width  = cropW;
        offscreen.height = cropH;
        offscreen.getContext('2d')!.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        return offscreen.toDataURL('image/png');
      } finally {
        canvasContent.style.transform = savedTransform;
      }
    }

    // Fallback (element not on canvas): direct capture without transform adjustment.
    return await htmlToImage.toPng(element, {
      quality: 1.0,
      backgroundColor,
      pixelRatio,
      width: element.offsetWidth,
      height: element.offsetHeight,
      filter: (el) => !el.classList?.contains('export-ignore'),
    });
  }

  /**
   * Export chart to PNG format
   */
  private static async exportToPNG(
    element: HTMLElement,
    filename: string,
    options: { quality: number; backgroundColor: string }
  ): Promise<void> {
    // Map quality (0–2) to pixelRatio (1–4) so the option has a real effect on sharpness.
    // Default quality=1.0 → pixelRatio=2 (same as the previous hardcoded value).
    const pixelRatio = Math.max(1, Math.min(4, options.quality * 2));
    const dataUrl = await this.captureElement(element, options.backgroundColor, pixelRatio);
    this.downloadDataUrl(dataUrl, `${filename}.png`);
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
    options: { backgroundColor: string }
  ): Promise<void> {
    // Use offsetWidth/offsetHeight (natural layout dims, unaffected by ancestor zoom)
    // so PDF page size doesn't vary with current canvas zoom level.
    const width  = element.offsetWidth;
    const height = element.offsetHeight;
    const dataUrl = await this.captureElement(element, options.backgroundColor, 2);

    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, height],
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    pdf.save(`${filename}.pdf`);
  }

  /**
   * Download a data URL as a file
   */
  private static downloadDataUrl(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
   * Export the full canvas (all elements) to PNG or PDF.
   *
   * Strategy: imperatively set the CSS transform on [data-canvas-content] to position
   * all elements flush to the top-left, capture [data-canvas-root] with html-to-image,
   * then restore the original transform. This bypasses the React render cycle entirely,
   * avoiding the flushSync + useEffect race where the DOM transform could lag behind.
   */
  static async exportFullCanvas(
    canvasContainer: HTMLElement,
    elements: CanvasElementBounds[],
    format: 'png' | 'pdf',
    options: ExportOptions = {}
  ): Promise<void> {
    if (elements.length === 0) {
      throw new Error('No elements to export');
    }

    const { filename = `canvas_${Date.now()}`, backgroundColor = '#ffffff' } = options;
    const PADDING = 40; // world-space padding around content
    const EXPORT_ZOOM = 1.0;

    // 1. Calculate bounding box in world coordinates
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      minX = Math.min(minX, el.position.x);
      minY = Math.min(minY, el.position.y);
      maxX = Math.max(maxX, el.position.x + el.size.width);
      maxY = Math.max(maxY, el.position.y + el.size.height);
    }

    const contentW = Math.ceil((maxX - minX + 2 * PADDING) * EXPORT_ZOOM);
    const contentH = Math.ceil((maxY - minY + 2 * PADDING) * EXPORT_ZOOM);

    // 2. Find DOM nodes — canvasRoot is the capture target; canvasContent holds the transform
    const canvasRoot    = canvasContainer.querySelector<HTMLElement>('[data-canvas-root]');
    const canvasContent = canvasContainer.querySelector<HTMLElement>('[data-canvas-content]');
    if (!canvasRoot || !canvasContent) throw new Error('Canvas DOM nodes not found');

    // 3. Compute export viewport: screenX = worldX*zoom + vx + cW/2  →  vx so minX-PADDING maps to 0
    const cW = canvasRoot.clientWidth;
    const cH = canvasRoot.clientHeight;
    const exportVx = -(minX - PADDING) * EXPORT_ZOOM - cW / 2;
    const exportVy = -(minY - PADDING) * EXPORT_ZOOM - cH / 2;

    const savedTransform = canvasContent.style.transform;

    try {
      // 4. Apply export transform imperatively — matches InfiniteCanvas's format exactly,
      //    bypassing React so the DOM is guaranteed to reflect the transform before capture.
      canvasContent.style.transform =
        `translate(${cW / 2}px, ${cH / 2}px) translate(${exportVx}px, ${exportVy}px) scale(${EXPORT_ZOOM})`;

      // 5. Two rAFs to let layout recalculation and compositing flush before capture
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      const dataUrl = await htmlToImage.toPng(canvasRoot, {
        quality: 1.0,
        backgroundColor,
        pixelRatio: 2,
        width: contentW,
        height: contentH,
        filter: (el) => {
          const cl = el.classList;
          if (!cl) return true;
          return !cl.contains('canvas-export-ignore') &&
                 !cl.contains('export-ignore') &&
                 !cl.contains('canvas-grid');
        },
      });

      if (format === 'png') {
        this.downloadDataUrl(dataUrl, `${filename}.png`);
      } else {
        const pdf = new jsPDF({
          orientation: contentW > contentH ? 'landscape' : 'portrait',
          unit: 'px',
          format: [contentW, contentH],
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, contentW, contentH);
        pdf.save(`${filename}.pdf`);
      }
    } finally {
      // 6. Always restore original transform so the canvas snaps back immediately
      canvasContent.style.transform = savedTransform;
    }
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
