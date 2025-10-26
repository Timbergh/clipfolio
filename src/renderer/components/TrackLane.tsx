import React, { useRef, useEffect, useState } from "react";
import "../styles/TrackLane.css";

interface TrackLaneProps {
  type: "video" | "audio";
  name: string;
  color: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  volume?: number;
  isMuted?: boolean;
  audioBuffer?: AudioBuffer;
  onVolumeChange?: (volume: number) => void;
  onMuteToggle?: () => void;
  onSeek?: (time: number) => void;
}

const TrackLane: React.FC<TrackLaneProps> = ({
  type,
  name,
  color,
  duration,
  trimStart,
  trimEnd,
  volume = 1.0,
  isMuted = false,
  audioBuffer,
  onVolumeChange,
  onMuteToggle,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  useEffect(() => {
    if (type === "audio" && audioBuffer && canvasRef.current) {
      drawWaveform();
    } else if (type === "video" && canvasRef.current) {
      drawVideoTrack();
    }
  }, [audioBuffer, duration, type, trimStart, trimEnd]);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Draw waveform in lighter color
    ctx.fillStyle = lightenColor(color, 40);
    ctx.globalAlpha = 1.0;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      const yMin = (1 + min) * amp;
      const yMax = (1 + max) * amp;
      const barHeight = yMax - yMin;

      ctx.fillRect(i, yMin, 1, barHeight || 1);
    }

    ctx.globalAlpha = 1.0;
  };

  const hexToRgba = (hex: string, alpha: number): string => {
    const h = hex.replace("#", "");
    const r = parseInt(h.substr(0, 2), 16);
    const g = parseInt(h.substr(2, 2), 16);
    const b = parseInt(h.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const lightenColor = (hexColor: string, percent: number): string => {
    // Convert hex to RGB
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Lighten
    const newR = Math.min(255, r + (255 - r) * (percent / 100));
    const newG = Math.min(255, g + (255 - g) * (percent / 100));
    const newB = Math.min(255, b + (255 - b) * (percent / 100));

    return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
  };

  const drawVideoTrack = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Validate duration to avoid division by zero or NaN
    if (!duration || duration <= 0 || !isFinite(duration)) return;

    // Calculate active region (non-trimmed area)
    const activeStartX = (trimStart / duration) * width;
    const activeEndX = (trimEnd / duration) * width;
    const activeWidth = activeEndX - activeStartX;

    // Validate calculated values
    if (!isFinite(activeStartX) || !isFinite(activeWidth) || activeWidth <= 0)
      return;

    // Only draw in the active (non-trimmed) region - using primary purple color
    ctx.fillStyle = "rgba(139, 92, 246, 0.2)";
    ctx.globalAlpha = 1.0;
    ctx.fillRect(activeStartX, 0, activeWidth, height);

    // Add subtle gradient only in active region
    const gradient = ctx.createLinearGradient(
      activeStartX,
      0,
      activeStartX,
      height
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.05)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(activeStartX, 0, activeWidth, height);

    ctx.globalAlpha = 1.0;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newVolume = parseFloat(e.target.value);

    // Snap to 100% (1.0) if close to it
    if (newVolume >= 0.99 && newVolume <= 1.01) {
      newVolume = 1.0;
    }

    onVolumeChange?.(newVolume);
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      // Volume X (muted)
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
          <line x1="22" x2="16" y1="9" y2="15" />
          <line x1="16" x2="22" y1="9" y2="15" />
        </svg>
      );
    }
    if (volume < 0.5) {
      // Volume 1 (low)
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
          <path d="M16 9a5 5 0 0 1 0 6" />
        </svg>
      );
    }
    // Volume 2 (full)
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
        <path d="M16 9a5 5 0 0 1 0 6" />
        <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
      </svg>
    );
  };

  const activeLeft = (trimStart / duration) * 100;
  const activeWidth = ((trimEnd - trimStart) / duration) * 100;

  return (
    <div
      className={`track-lane ${
        type === "video" ? "video-track" : "audio-track"
      }`}
    >
      <div className="track-header">
        {type === "video" ? (
          <div className="track-icon">
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
              <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
              <rect x="2" y="6" width="14" height="12" rx="2" />
            </svg>
          </div>
        ) : (
          <div
            className="volume-control"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              className="track-icon volume-icon-btn"
              onClick={() => onVolumeChange?.(volume === 0 ? 1.0 : 0)}
              title={volume === 0 ? "Unmute" : "Mute"}
            >
              {getVolumeIcon()}
            </button>
            {showVolumeSlider && (
              <div className="volume-slider-popup">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="volume-slider-horizontal"
                />
                <span className="volume-value">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            )}
          </div>
        )}
        <div className="track-info">
          <div className="track-name">{name}</div>
        </div>
      </div>

      <div className="track-content">
        <div
          className="track-background"
          style={{
            backgroundColor:
              type === "video"
                ? "rgba(var(--primary-color), var(--glass-medium))"
                : hexToRgba(color, 0.15),
            left: `${activeLeft}%`,
            width: `${activeWidth}%`,
          }}
        />

        <canvas
          ref={canvasRef}
          className="track-canvas-full"
          width={1200}
          height={40}
        />

        {type === "video" && (
          <div
            className="track-active-area"
            style={{
              left: `${activeLeft}%`,
              width: `${activeWidth}%`,
              borderColor: "rgba(var(--primary-color), 0.4)",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TrackLane;
