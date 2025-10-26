import React from "react";
import { VideoFile, VideoFileWithMetadata } from "../types";
import "../styles/VideoGrid.css";
import LazyThumbnail from "./LazyThumbnail";

interface VideoGridProps {
  videos: VideoFile[] | VideoFileWithMetadata[];
  onVideoSelect: (video: VideoFile | VideoFileWithMetadata) => void;
  onToggleFavorite?: (video: VideoFileWithMetadata) => void;
  selectedVideos?: Set<string>;
  onToggleSelect?: (videoPath: string) => void;
}

const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  onVideoSelect,
  onToggleFavorite,
  selectedVideos,
  onToggleSelect,
}) => {
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

  return (
    <div className="video-grid">
      {videos.map((video, index) => (
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
                (video as VideoFileWithMetadata).isFavorite ? "favorited" : ""
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
                title={selectedVideos.has(video.path) ? "Deselect" : "Select"}
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
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
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
      ))}
    </div>
  );
};

export default VideoGrid;
