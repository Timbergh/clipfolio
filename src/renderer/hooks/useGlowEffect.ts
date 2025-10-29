import { useEffect } from "react";

interface GlowEffectOptions {
  glowSize?: number;
  glowColor?: string;
  glowIntensity?: number;
  borderGlowIntensity?: number;
  transitionDuration?: number;
}

// Global glow effect manager
class GlowEffectManager {
  private options: GlowEffectOptions;
  private mouseMoveHandler: (e: MouseEvent) => void;

  constructor(options: GlowEffectOptions = {}) {
    this.options = {
      glowSize: 160,
      glowColor: "255, 255, 255",
      glowIntensity: 0.12,
      borderGlowIntensity: 0.95,
      transitionDuration: 120,
      ...options,
    };

    this.mouseMoveHandler = (e: MouseEvent) => {
      // Find the glow element under the mouse
      const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
      if (!elementUnderMouse) return;

      // Find the closest glow element (including the element itself)
      const glowElement = elementUnderMouse.closest('[data-glow]') as HTMLElement;
      if (!glowElement) return;

      // Calculate relative position
      const rect = glowElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      // Update the glow position
      glowElement.style.setProperty("--mx", `${x}%`);
      glowElement.style.setProperty("--my", `${y}%`);
    };
  }

  init() {
    // Add global mouse move listener
    document.addEventListener("mousemove", this.mouseMoveHandler);
    
    // Set CSS custom properties on document root for default values
    document.documentElement.style.setProperty("--glow-size", `${this.options.glowSize}px`);
    document.documentElement.style.setProperty("--glow-color", this.options.glowColor!);
    document.documentElement.style.setProperty("--glow-intensity", this.options.glowIntensity!.toString());
    document.documentElement.style.setProperty("--border-glow-intensity", this.options.borderGlowIntensity!.toString());
    document.documentElement.style.setProperty("--transition-duration", `${this.options.transitionDuration}ms`);
  }

  destroy() {
    document.removeEventListener("mousemove", this.mouseMoveHandler);
  }
}

// Global instance
let glowManager: GlowEffectManager | null = null;

export const useGlowEffect = (options?: GlowEffectOptions) => {
  useEffect(() => {
    if (!glowManager) {
      glowManager = new GlowEffectManager(options);
      glowManager.init();
    }

    return () => {
      // Only destroy when component unmounts and no other components are using it
      // This is a simple implementation - in a real app you'd want reference counting
    };
  }, []);
};