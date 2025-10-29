import React, { useEffect, useRef, useState, memo } from "react";
import { getThumbnailFor, getCachedThumbnailPath } from "../utils/thumbCache";

interface LazyThumbnailProps {
  videoPath: string;
  alt: string;
  className?: string;
  placeholder?: React.ReactNode;
  children?: React.ReactNode;
  observerRoot?: Element | null;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
}

const LazyThumbnail: React.FC<LazyThumbnailProps> = memo(
  ({
    videoPath,
    alt,
    className,
    placeholder,
    children,
    observerRoot,
    duration,
    trimStart,
    trimEnd,
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(false);
    const [thumbPath, setThumbPath] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setVisible(true);
            } else {
              setVisible(false);
            }
          }
        },
        { root: observerRoot || null, rootMargin: "400px 0px" }
      );

      observer.observe(el);
      return () => observer.disconnect();
    }, [observerRoot]);

    // Reset when video or trim parameters change
    useEffect(() => {
      setThumbPath("");
      setHasLoadedOnce(false);
      setIsLoading(false);
    }, [videoPath, trimStart, trimEnd]);

    // Load thumbnail when visible
    useEffect(() => {
      let canceled = false;

      if (!visible || thumbPath) return;

      setIsLoading(true);

      (async () => {
        try {
          const p = await getThumbnailFor(
            videoPath,
            "high",
            duration,
            trimStart,
            trimEnd
          );
          if (!canceled && p) {
            setThumbPath(p);
            setHasLoadedOnce(true);
          }
        } catch (error) {
          console.error("Error loading thumbnail:", error);
        } finally {
          if (!canceled) {
            setIsLoading(false);
          }
        }
      })();

      return () => {
        canceled = true;
      };
    }, [visible, thumbPath, videoPath, duration, trimStart, trimEnd]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ position: "relative" }}
      >
        {thumbPath ? (
          <img
            key={thumbPath}
            src={window.path.toLocalURL(thumbPath)}
            alt={alt}
            decoding="async"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
        ) : (
          placeholder || (
            <div className="thumbnail-placeholder">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="clapperboard-icon"
              >
                <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
                <path d="m6.2 5.3 3.1 3.9" />
                <path d="m12.4 3.4 3.1 4" />
                <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              </svg>
            </div>
          )
        )}
        {children}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if critical props change
    return (
      prevProps.videoPath === nextProps.videoPath &&
      prevProps.alt === nextProps.alt &&
      prevProps.className === nextProps.className &&
      prevProps.observerRoot === nextProps.observerRoot &&
      prevProps.duration === nextProps.duration &&
      prevProps.trimStart === nextProps.trimStart &&
      prevProps.trimEnd === nextProps.trimEnd
      // Note: We intentionally don't compare children and placeholder as they're often inline JSX
      // with new references, but their content is typically stable
    );
  }
);

LazyThumbnail.displayName = "LazyThumbnail";

export default LazyThumbnail;
