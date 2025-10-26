export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface MultiZoneColors {
  center: ColorRGB;
  topLeft: ColorRGB;
  topRight: ColorRGB;
  bottomLeft: ColorRGB;
  bottomRight: ColorRGB;
  average: ColorRGB;
}

/**
 * Samples the dominant color from a video frame
 * Uses a canvas to extract pixel data and calculate average color
 */
export class VideoColorSampler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sampleSize = 64; // Sample a 64x64 grid for better quality
  
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.sampleSize;
    this.canvas.height = this.sampleSize;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  /**
   * Extracts the average color from a video element
   */
  public sampleColor(video: HTMLVideoElement): ColorRGB {
    if (!video) {
      console.warn('❌ No video element provided');
      return { r: 15, g: 15, b: 15 };
    }
    
    if (video.readyState < 2) {
      console.warn('⏳ Video not ready, readyState:', video.readyState);
      return { r: 15, g: 15, b: 15 };
    }

    try {
      // Draw the video frame to canvas (downscaled for performance)
      this.ctx.drawImage(video, 0, 0, this.sampleSize, this.sampleSize);
      
      // Get pixel data
      const imageData = this.ctx.getImageData(0, 0, this.sampleSize, this.sampleSize);
      const pixels = imageData.data;
      
      let r = 0, g = 0, b = 0;
      let count = 0;
      
      // Sample every 4th pixel for better performance
      for (let i = 0; i < pixels.length; i += 16) {
        const pixelR = pixels[i];
        const pixelG = pixels[i + 1];
        const pixelB = pixels[i + 2];
        
        // Skip very dark pixels (likely black bars)
        if (pixelR > 10 || pixelG > 10 || pixelB > 10) {
          r += pixelR;
          g += pixelG;
          b += pixelB;
          count++;
        }
      }
      
      if (count === 0) {
        return { r: 15, g: 15, b: 15 };
      }
      
      // Calculate average - keep MUCH more color vibrancy
      const avgR = Math.floor((r / count) * 0.85); // Keep 85% of original intensity
      const avgG = Math.floor((g / count) * 0.85);
      const avgB = Math.floor((b / count) * 0.85);
      
      // Allow much brighter colors
      const result = {
        r: Math.max(30, Math.min(avgR, 180)),
        g: Math.max(30, Math.min(avgG, 180)),
        b: Math.max(30, Math.min(avgB, 180))
      };
      
      console.log('✅ Color sampled successfully:', result, `from ${count} valid pixels`);
      return result;
    } catch (error) {
      console.error('Error sampling video color:', error);
      return { r: 15, g: 15, b: 15 };
    }
  }

  private lastValidColors: MultiZoneColors | null = null;

  /**
   * Samples colors from multiple zones of the video for richer gradients
   */
  public sampleMultiZoneColors(video: HTMLVideoElement): MultiZoneColors {
    if (!video || video.readyState < 2) {
      // Return last valid colors instead of default dark colors
      if (this.lastValidColors) {
        return this.lastValidColors;
      }
      const defaultColor = { r: 15, g: 15, b: 15 };
      return {
        center: defaultColor,
        topLeft: defaultColor,
        topRight: defaultColor,
        bottomLeft: defaultColor,
        bottomRight: defaultColor,
        average: defaultColor
      };
    }

    try {
      this.ctx.drawImage(video, 0, 0, this.sampleSize, this.sampleSize);
      
      let imageData: ImageData;
      try {
        imageData = this.ctx.getImageData(0, 0, this.sampleSize, this.sampleSize);
      } catch (crossOriginError) {
        console.warn('Canvas tainted by cross-origin data, using fallback colors');
        // Return last valid colors or default
        if (this.lastValidColors) {
          return this.lastValidColors;
        }
        const defaultColor = { r: 15, g: 15, b: 15 };
        return {
          center: defaultColor,
          topLeft: defaultColor,
          topRight: defaultColor,
          bottomLeft: defaultColor,
          bottomRight: defaultColor,
          average: defaultColor
        };
      }
      
      const pixels = imageData.data;

      // Helper to sample a specific zone
      const sampleZone = (startX: number, startY: number, endX: number, endY: number): ColorRGB => {
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const i = (y * this.sampleSize + x) * 4;
            const pixelR = pixels[i];
            const pixelG = pixels[i + 1];
            const pixelB = pixels[i + 2];
            
            if (pixelR > 10 || pixelG > 10 || pixelB > 10) {
              r += pixelR;
              g += pixelG;
              b += pixelB;
              count++;
            }
          }
        }
        
        if (count === 0) return { r: 15, g: 15, b: 15 };
        
        const avgR = Math.floor((r / count) * 0.85);
        const avgG = Math.floor((g / count) * 0.85);
        const avgB = Math.floor((b / count) * 0.85);
        
        return {
          r: Math.max(30, Math.min(avgR, 180)),
          g: Math.max(30, Math.min(avgG, 180)),
          b: Math.max(30, Math.min(avgB, 180))
        };
      };

      const half = Math.floor(this.sampleSize / 2);
      const quarter = Math.floor(this.sampleSize / 4);
      const threeQuarter = Math.floor(this.sampleSize * 3 / 4);

      // Sample different zones
      const center = sampleZone(quarter, quarter, threeQuarter, threeQuarter);
      const topLeft = sampleZone(0, 0, half, half);
      const topRight = sampleZone(half, 0, this.sampleSize, half);
      const bottomLeft = sampleZone(0, half, half, this.sampleSize);
      const bottomRight = sampleZone(half, half, this.sampleSize, this.sampleSize);

      // Calculate weighted average (center gets more weight)
      const average = {
        r: Math.floor((center.r * 2 + topLeft.r + topRight.r + bottomLeft.r + bottomRight.r) / 6),
        g: Math.floor((center.g * 2 + topLeft.g + topRight.g + bottomLeft.g + bottomRight.g) / 6),
        b: Math.floor((center.b * 2 + topLeft.b + topRight.b + bottomLeft.b + bottomRight.b) / 6)
      };

      const result = { center, topLeft, topRight, bottomLeft, bottomRight, average };
      
      // Store the last valid colors
      this.lastValidColors = result;
      
      return result;
    } catch (error) {
      console.error('Error sampling multi-zone colors:', error);
      
      // Return last valid colors if available
      if (this.lastValidColors) {
        return this.lastValidColors;
      }
      
      const defaultColor = { r: 15, g: 15, b: 15 };
      return {
        center: defaultColor,
        topLeft: defaultColor,
        topRight: defaultColor,
        bottomLeft: defaultColor,
        bottomRight: defaultColor,
        average: defaultColor
      };
    }
  }

  /**
   * Converts RGB to CSS color string
   */
  public static rgbToCss(color: ColorRGB): string {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }

  /**
   * Interpolates between two colors for smooth transitions
   */
  public static interpolateColor(from: ColorRGB, to: ColorRGB, progress: number): ColorRGB {
    return {
      r: Math.round(from.r + (to.r - from.r) * progress),
      g: Math.round(from.g + (to.g - from.g) * progress),
      b: Math.round(from.b + (to.b - from.b) * progress)
    };
  }
}

