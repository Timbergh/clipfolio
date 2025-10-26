import React, { useRef, useEffect, useState, useCallback } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { VideoFile, VideoFileWithMetadata } from "../types";
import "../styles/VideoGrid.css";
import LazyThumbnail from "./LazyThumbnail";
import { preloadThumbnails } from "../utils/thumbCache";

interface VirtualizedVideoGridProps {
  videos: VideoFile[] | VideoFileWithMetadata[];
  onVideoSelect: (video: VideoFile | VideoFileWithMetadata) => void;
  onToggleFavorite?: (video: VideoFileWithMetadata) => void;
  selectedVideos?: Set<string>;
  onToggleSelect?: (videoPath: string) => void;
  scrollParentRef?: React.RefObject<HTMLDivElement | null>;
}

const CARD_MIN_WIDTH = 280;
const CARD_GAP = 24;
const ROW_GAP = 24;

// Dynamic height calculation based on CSS values
const getCardHeight = (containerWidth: number): number => {
  // Base thumbnail height from CSS
  let thumbnailHeight = 180; // Default from CSS

  // Responsive thumbnail heights matching CSS breakpoints
  if (containerWidth <= 480) {
    thumbnailHeight = 140;
  } else if (containerWidth <= 768) {
    thumbnailHeight = 160;
  } else if (containerWidth >= 1200) {
    thumbnailHeight = 200;
  }

  // Video info section height: padding (18px * 2) + name height (~20px) + meta height (~20px) + margins
  const videoInfoHeight = 18 + 20 + 12 + 20 + 18; // ~88px total

  return thumbnailHeight + videoInfoHeight;
};

const VirtualizedVideoGrid: React.FC<VirtualizedVideoGridProps> = ({
  videos,
  onVideoSelect,
  onToggleFavorite,
  selectedVideos,
  onToggleSelect,
  scrollParentRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [columnsPerRow, setColumnsPerRow] = useState(1);

  // Calculate columns per row based on container width
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(width);

        // Calculate how many columns can fit
        const cols = Math.max(
          1,
          Math.floor((width + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP))
        );
        setColumnsPerRow(cols);
      }
    };

    updateDimensions();

    // Use ResizeObserver for better performance than window resize
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", updateDimensions);
    return () => {
      window.removeEventListener("resize", updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);

  const handleFavoriteClick = (
    e: React.MouseEvent,
    video: VideoFileWithMetadata
  ) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(video);
    }
  };

  const handleSelectClick = (e: React.MouseEvent, videoPath: string) => {
    e.stopPropagation();
    if (onToggleSelect) {
      onToggleSelect(videoPath);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (videos.length === 0) {
    return (
      <div className="empty-grid">
        <p>No videos found in this folder</p>
      </div>
    );
  }

  // Calculate total number of rows needed
  const rowCount = Math.ceil(videos.length / columnsPerRow);

  // Row renderer
  const Row = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const startIndex = index * columnsPerRow;
    const endIndex = Math.min(startIndex + columnsPerRow, videos.length);
    const rowVideos = videos.slice(startIndex, endIndex);

    return (
      <div style={style}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columnsPerRow}, 1fr)`,
            gap: `${CARD_GAP}px`,
            padding: "0 10px",
          }}
        >
          {rowVideos.map((video, colIndex) => {
            return (
              <div
                key={video.path}
                className="video-card"
                onClick={() => onVideoSelect(video)}
              >
                <LazyThumbnail
                  className="clip-thumbnail"
                  videoPath={video.path}
                  alt={video.name}
                  placeholder={
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
                  }
                  observerRoot={scrollParentRef?.current || undefined}
                >
                  {video.duration !== undefined &&
                    (() => {
                      const videoWithMeta = video as VideoFileWithMetadata;
                      const hasTrimEdits =
                        videoWithMeta.edits?.trimStart !== undefined &&
                        videoWithMeta.edits?.trimEnd !== undefined;
                      const displayDuration = hasTrimEdits
                        ? videoWithMeta.edits!.trimEnd! -
                          videoWithMeta.edits!.trimStart!
                        : video.duration;

                      return (
                        <div
                          className={`duration-badge ${
                            hasTrimEdits ? "trimmed" : ""
                          }`}
                        >
                          {hasTrimEdits && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ marginRight: "4px" }}
                            >
                              <circle cx="6" cy="6" r="3" />
                              <path d="M8.12 8.12 12 12" />
                              <path d="M20 4 8.12 15.88" />
                              <circle cx="6" cy="18" r="3" />
                              <path d="M14.8 14.8 20 20" />
                            </svg>
                          )}
                          {formatDuration(displayDuration)}
                        </div>
                      );
                    })()}
                  <button
                    className={`favorite-button ${
                      (video as VideoFileWithMetadata).isFavorite
                        ? "favorited"
                        : ""
                    }`}
                    onClick={(e) =>
                      handleFavoriteClick(e, video as VideoFileWithMetadata)
                    }
                    title={
                      (video as VideoFileWithMetadata).isFavorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill={
                        (video as VideoFileWithMetadata).isFavorite
                          ? "currentColor"
                          : "none"
                      }
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                  {onToggleSelect && selectedVideos && (
                    <button
                      className={`select-button ${
                        selectedVideos.has(video.path) ? "selected" : ""
                      }`}
                      onClick={(e) => handleSelectClick(e, video.path)}
                      title={
                        selectedVideos.has(video.path) ? "Deselect" : "Select"
                      }
                    >
                      {selectedVideos.has(video.path) ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                        </svg>
                      )}
                    </button>
                  )}
                </LazyThumbnail>

                <div className="video-info">
                  <h3 className="video-name" title={video.name}>
                    {video.name}
                  </h3>
                  <div className="video-meta">
                    <span className="meta-item">
                      <svg
                        className="meta-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M8 2v4" />
                        <path d="M16 2v4" />
                        <rect width="18" height="18" x="3" y="4" rx="2" />
                        <path d="M3 10h18" />
                      </svg>
                      {formatDate(video.created)}
                    </span>
                    <span className="meta-item">
                      <svg
                        className="meta-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                        <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
                        <path d="M7 3v4a1 1 0 0 0 1 1h7" />
                      </svg>
                      {formatFileSize(video.size)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    estimateSize: () => getCardHeight(containerWidth) + ROW_GAP,
    overscan: 4,
    getScrollElement: () => (scrollParentRef ? scrollParentRef.current : null),
  });

  useEffect(() => {
    const items = rowVirtualizer.getVirtualItems();
    if (!items.length) return;
    const visibleVideoPaths: string[] = [];
    for (const it of items) {
      const startIndex = it.index * columnsPerRow;
      const endIndex = Math.min(startIndex + columnsPerRow, videos.length);
      for (let i = startIndex; i < endIndex; i++) {
        visibleVideoPaths.push(videos[i].path);
      }
    }
    if (visibleVideoPaths.length) preloadThumbnails(visibleVideoPaths);
  }, [rowVirtualizer, columnsPerRow, videos]);

  return (
    <div
      ref={containerRef}
      className="virtualized-grid-container"
      style={{ width: "100%" }}
    >
      <div
        style={{
          position: "relative",
          height: rowVirtualizer.getTotalSize(),
          width: "100%",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow: VirtualItem) => {
          const cardHeight = getCardHeight(containerWidth);
          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                height: cardHeight + ROW_GAP,
              }}
            >
              <Row index={virtualRow.index} style={{ height: cardHeight }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualizedVideoGrid;
