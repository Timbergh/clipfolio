import React, { useEffect, useRef, useState } from "react";
import { getThumbnailFor, getCachedThumbnailPath } from "../utils/thumbCache";

interface LazyThumbnailProps {
  videoPath: string;
  alt: string;
  className?: string;
  placeholder?: React.ReactNode;
  children?: React.ReactNode;
  observerRoot?: Element | null;
}

const LazyThumbnail: React.FC<LazyThumbnailProps> = ({
  videoPath,
  alt,
  className,
  placeholder,
  children,
  observerRoot,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [thumbPath, setThumbPath] = useState<string>(
    () => getCachedThumbnailPath(videoPath) || ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(
    !!getCachedThumbnailPath(videoPath)
  );

  // Reset thumbnail state when videoPath changes
  useEffect(() => {
    const cachedPath = getCachedThumbnailPath(videoPath);
    setThumbPath(cachedPath || "");
    setHasLoadedOnce(!!cachedPath);
    setIsLoading(false);
  }, [videoPath]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Reset visibility when videoPath changes
    setVisible(false);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { root: observerRoot || null, rootMargin: "400px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [videoPath, observerRoot]);

  useEffect(() => {
    let canceled = false;
    if (!visible) return;

    if (thumbPath) return; // already have it (avoid redundant flashes)
    setIsLoading(true);

    (async () => {
      try {
        const p = await getThumbnailFor(videoPath, "high");
        if (!canceled && p) {
          setThumbPath(p);
        }
      } catch (error) {
        console.error("Error loading thumbnail:", error);
      } finally {
        if (!canceled) {
          setIsLoading(false);
          setHasLoadedOnce(true);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [visible, videoPath]);

  return (
    <div ref={containerRef} className={className}>
      {thumbPath ? (
        <img
          src={window.path.toLocalURL(thumbPath)}
          alt={alt}
          loading="lazy"
          decoding="async"
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
};

export default LazyThumbnail;
