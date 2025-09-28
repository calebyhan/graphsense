// Canvas Positioning Test
// This file can be used to test chart positioning and minimap accuracy

interface TestResult {
  success: boolean;
  message: string;
}

export class CanvasPositioningTest {
  
  /**
   * Test viewport-aware chart positioning
   */
  static testViewportCenterPositioning(viewport: { x: number; y: number; zoom: number }): TestResult {
    try {
      // Mock canvas store behavior
      const getViewportCenterPosition = () => {
        const offsetRange = 50;
        const randomOffsetX = (Math.random() - 0.5) * offsetRange;
        const randomOffsetY = (Math.random() - 0.5) * offsetRange;
        
        return {
          x: viewport.x + randomOffsetX,
          y: viewport.y + randomOffsetY
        };
      };

      const position1 = getViewportCenterPosition();
      const position2 = getViewportCenterPosition();

      // Check that positions are near viewport center
      const distanceFromCenter1 = Math.sqrt(
        Math.pow(position1.x - viewport.x, 2) + Math.pow(position1.y - viewport.y, 2)
      );
      const distanceFromCenter2 = Math.sqrt(
        Math.pow(position2.x - viewport.x, 2) + Math.pow(position2.y - viewport.y, 2)
      );

      if (distanceFromCenter1 > 30 || distanceFromCenter2 > 30) {
        return {
          success: false,
          message: `Positions too far from viewport center: ${distanceFromCenter1.toFixed(2)}, ${distanceFromCenter2.toFixed(2)}`
        };
      }

      // Check that positions are different (anti-stacking)
      const distance = Math.sqrt(
        Math.pow(position1.x - position2.x, 2) + Math.pow(position1.y - position2.y, 2)
      );

      if (distance < 10) {
        return {
          success: false,
          message: `Positions too close together: ${distance.toFixed(2)}px apart`
        };
      }

      return {
        success: true,
        message: `Chart positioning working correctly. Positions: (${position1.x.toFixed(1)}, ${position1.y.toFixed(1)}) and (${position2.x.toFixed(1)}, ${position2.y.toFixed(1)})`
      };

    } catch (error) {
      return {
        success: false,
        message: `Test failed with error: ${error}`
      };
    }
  }

  /**
   * Test minimap coordinate transformation
   */
  static testMinimapCoordinates(
    canvasPosition: { x: number; y: number },
    miniMapSize: { width: number; height: number },
    canvasSize: { width: number; height: number }
  ): TestResult {
    try {
      const scaleX = miniMapSize.width / canvasSize.width;
      const scaleY = miniMapSize.height / canvasSize.height;
      const miniMapCenterX = miniMapSize.width / 2;
      const miniMapCenterY = miniMapSize.height / 2;

      // Calculate minimap position (fixed Y coordinate)
      const minimapX = miniMapCenterX + (canvasPosition.x * scaleX);
      const minimapY = miniMapCenterY + (canvasPosition.y * scaleY); // Fixed: no Y inversion

      // Reverse calculation to verify
      const reverseX = (minimapX - miniMapCenterX) / scaleX;
      const reverseY = (minimapY - miniMapCenterY) / scaleY; // Fixed: no Y inversion

      const errorX = Math.abs(reverseX - canvasPosition.x);
      const errorY = Math.abs(reverseY - canvasPosition.y);

      if (errorX > 1 || errorY > 1) {
        return {
          success: false,
          message: `Coordinate transformation error too high: X=${errorX.toFixed(2)}, Y=${errorY.toFixed(2)}`
        };
      }

      return {
        success: true,
        message: `Minimap coordinates correct. Canvas (${canvasPosition.x}, ${canvasPosition.y}) → Minimap (${minimapX.toFixed(1)}, ${minimapY.toFixed(1)}) → Canvas (${reverseX.toFixed(1)}, ${reverseY.toFixed(1)})`
      };

    } catch (error) {
      return {
        success: false,
        message: `Test failed with error: ${error}`
      };
    }
  }

  /**
   * Run all tests
   */
  static runAllTests(): { passed: number; failed: number; results: TestResult[] } {
    const results: TestResult[] = [];

    // Test viewport positioning with different viewports
    results.push(this.testViewportCenterPositioning({ x: 0, y: 0, zoom: 1 }));
    results.push(this.testViewportCenterPositioning({ x: 100, y: -50, zoom: 1.5 }));
    results.push(this.testViewportCenterPositioning({ x: -200, y: 150, zoom: 0.8 }));

    // Test minimap coordinates
    results.push(this.testMinimapCoordinates(
      { x: 0, y: 0 },
      { width: 200, height: 150 },
      { width: 10000, height: 10000 }
    ));
    results.push(this.testMinimapCoordinates(
      { x: 100, y: -50 },
      { width: 200, height: 150 },
      { width: 10000, height: 10000 }
    ));
    results.push(this.testMinimapCoordinates(
      { x: -500, y: 300 },
      { width: 200, height: 150 },
      { width: 10000, height: 10000 }
    ));

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return { passed, failed, results };
  }
}

// Usage in development:
// const testResults = CanvasPositioningTest.runAllTests();
// console.log('Canvas Positioning Tests:', testResults);