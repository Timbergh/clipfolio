import React, { useRef, useEffect, useState } from "react";
import TrackLane from "./TrackLane";
import { AudioTrack } from "../types";
import "../styles/Timeline.css";

interface TimelineProps {
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  onSeek: (time: number) => void;
  onTrimStartChange: (time: number) => void;
  onTrimEndChange: (time: number) => void;
  videoPath: string;
  audioTracks: AudioTrack[];
  audioBuffers: AudioBuffer[];
  onVolumeChange: (trackIndex: number, volume: number) => void;
  onMuteToggle: (trackIndex: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({
  duration,
  currentTime,
  trimStart,
  trimEnd,
  onSeek,
  onTrimStartChange,
  onTrimEndChange,
  videoPath,
  audioTracks,
  audioBuffers,
  onVolumeChange,
  onMuteToggle,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getTimelineIntervals = (
    duration: number,
    rulerWidthPx: number
  ): {
    majorInterval: number;
    mediumInterval: number | null;
    minorInterval: number | null;
  } => {
    // Minimum desired pixel spacing between ticks of each level
    const minMajorPx = 64;
    const minMediumPx = 32;
    const minMinorPx = 12;

    // Nice intervals in seconds
    const niceNumbers = [
      0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 300, 600, 900, 1200,
      1800, 3600,
    ];

    const getSpacingForInterval = (interval: number) => {
      if (rulerWidthPx <= 0) return Number.POSITIVE_INFINITY;
      const count = Math.floor(duration / interval) + 1; // includes endpoints if aligned
      if (count <= 1) return Number.POSITIVE_INFINITY;
      return rulerWidthPx / (count - 1);
    };

    // Choose the smallest nice major interval that keeps labels at least minMajorPx apart
    let majorInterval = niceNumbers[0];
    for (const candidate of niceNumbers) {
      const spacing = getSpacingForInterval(candidate);
      if (spacing >= minMajorPx) {
        majorInterval = candidate;
        break;
      }
      majorInterval = candidate;
    }

    // Determine medium interval only if it can fit between majors with enough space
    const majorSpacing = getSpacingForInterval(majorInterval);
    let mediumInterval: number | null = null;
    if (majorSpacing >= 5 * minMediumPx) {
      mediumInterval = majorInterval / 5;
    } else if (majorSpacing >= 2 * minMediumPx) {
      mediumInterval = majorInterval / 2;
    }

    // Determine minor interval based on medium or major spacing
    let minorInterval: number | null = null;
    if (mediumInterval) {
      const mediumSpacing = getSpacingForInterval(mediumInterval);
      if (mediumSpacing >= 5 * minMinorPx) {
        minorInterval = mediumInterval / 5;
      } else if (mediumSpacing >= 2 * minMinorPx) {
        minorInterval = mediumInterval / 2;
      }
    } else {
      if (majorSpacing >= 5 * minMinorPx) {
        minorInterval = majorInterval / 5;
      } else if (majorSpacing >= 2 * minMinorPx) {
        minorInterval = majorInterval / 2;
      }
    }

    return { majorInterval, mediumInterval, minorInterval };
  };

  const getTimeFromPosition = (clientX: number): number => {
    if (!timelineRef.current) return 0;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * duration;
  };

  const getTimeFromPositionWithOffset = (clientX: number): number => {
    const trackContent = document.querySelector(".track-content");
    if (!trackContent) return 0;

    const rect = trackContent.getBoundingClientRect();
    const x = clientX - rect.left;
    const availableWidth = rect.width;
    const percentage = Math.max(0, Math.min(1, x / availableWidth));
    return percentage * duration;
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    type: "start" | "end" | "playhead"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "start") {
      setIsDraggingStart(true);
    } else if (type === "end") {
      setIsDraggingEnd(true);
    } else {
      setIsDraggingPlayhead(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingStart && !isDraggingEnd && !isDraggingPlayhead) return;

    let time: number;

    if (isDraggingStart || isDraggingEnd || isDraggingPlayhead) {
      // Use offset-aware positioning for handles and playhead
      time = getTimeFromPositionWithOffset(e.clientX);
    } else {
      time = getTimeFromPosition(e.clientX);
    }

    if (isDraggingStart) {
      const newTrimStart = Math.max(0, Math.min(time, trimEnd - 0.1));
      onTrimStartChange(newTrimStart);
      onSeek(newTrimStart);
    } else if (isDraggingEnd) {
      const newTrimEnd = Math.max(trimStart + 0.1, Math.min(time, duration));
      onTrimEndChange(newTrimEnd);
      onSeek(newTrimEnd);
    } else if (isDraggingPlayhead) {
      onSeek(Math.max(0, Math.min(time, duration)));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
    setIsDraggingPlayhead(false);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    // Start dragging the playhead immediately when clicking anywhere on timeline
    const time = getTimeFromPosition(e.clientX);
    onSeek(time);
    setIsDraggingPlayhead(true);
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    // Handle clicks anywhere in the timeline container
    const target = e.target as HTMLElement;
    // Don't handle if clicking on controls or handles
    if (
      target.closest(".trim-handle-overlay") ||
      target.closest(".global-playhead-overlay") ||
      target.closest(".track-header") ||
      target.closest(".volume-control")
    ) {
      return;
    }
    const time = getTimeFromPositionWithOffset(e.clientX);
    onSeek(time);
    setIsDraggingPlayhead(true);
  };

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDraggingStart,
    isDraggingEnd,
    isDraggingPlayhead,
    trimStart,
    trimEnd,
    duration,
  ]);

  const currentPercentage = (currentTime / duration) * 100;
  const trimStartPercentage = (trimStart / duration) * 100;
  const trimEndPercentage = (trimEnd / duration) * 100;

  return (
    <div className="timeline-container" style={{ position: "relative" }}>
      {/* Time ruler with seek area */}
      <div className="time-ruler-container">
        <div className="time-ruler-spacer">
          <div className="timeline-time-display">
            <span className="time-current">{formatTime(currentTime)}</span>
            <span className="time-separator">/</span>
            <span className="time-total">{formatTime(duration)}</span>
          </div>
        </div>
        <div
          ref={timelineRef}
          className="time-ruler"
          onMouseDown={handleTimelineMouseDown}
        >
          {(() => {
            const rulerWidthPx = timelineRef.current?.clientWidth ?? 0;
            const { majorInterval, mediumInterval, minorInterval } =
              getTimelineIntervals(duration, rulerWidthPx);
            const markers: React.ReactElement[] = [];

            // Collect all marker times with their types
            const markerData: Array<{
              time: number;
              type: "major" | "medium" | "minor";
            }> = [];

            markerData.push({ time: 0, type: "major" });

            for (let i = 1; i * majorInterval < duration; i++) {
              const time = i * majorInterval;
              markerData.push({ time, type: "major" });
            }

            if (mediumInterval) {
              const eps = 1e-9;
              for (let i = 1; i * mediumInterval < duration; i++) {
                const time = i * mediumInterval;
                const k = Math.round(time / majorInterval);
                const alignsWithMajor =
                  Math.abs(time - k * majorInterval) < eps;
                if (!alignsWithMajor) {
                  markerData.push({ time, type: "medium" });
                }
              }
            }

            // Generate minor markers between start and end (lowest priority
            if (minorInterval) {
              const eps = 1e-9;
              for (let i = 1; i * minorInterval < duration; i++) {
                const time = i * minorInterval;
                const kMajor = Math.round(time / majorInterval);
                const alignsWithMajor =
                  Math.abs(time - kMajor * majorInterval) < eps;
                let alignsWithMedium = false;
                if (mediumInterval) {
                  const kMedium = Math.round(time / mediumInterval);
                  alignsWithMedium =
                    Math.abs(time - kMedium * mediumInterval) < eps;
                }
                if (!alignsWithMajor && !alignsWithMedium) {
                  markerData.push({ time, type: "minor" });
                }
              }
            }

            const typePriority = { major: 0, medium: 1, minor: 2 };
            markerData.sort((a, b) => {
              const priorityDiff = typePriority[a.type] - typePriority[b.type];
              if (priorityDiff !== 0) return priorityDiff;
              return a.time - b.time;
            });

            const placedPixelPositions: number[] = [];
            const placedTimes: number[] = [];
            const usedPercentageKeys = new Set<number>();

            const minPixelGap = 8; // px
            const safeMedium =
              typeof mediumInterval === "number"
                ? mediumInterval
                : majorInterval / 2;
            const safeMinor =
              typeof minorInterval === "number"
                ? minorInterval
                : safeMedium / 2;
            const fallbackMinTimeGap = Math.min(
              majorInterval * 0.25,
              Math.max(safeMedium * 0.5, safeMinor * 0.8)
            );

            markerData.forEach((data, index) => {
              const percentageKey = Math.round((data.time / duration) * 100000);
              if (usedPercentageKeys.has(percentageKey)) {
                return;
              }

              const isFirst = data.time === 0;
              const isLast = Math.abs(data.time - duration) < 0.000001;

              let canPlace = true;
              if (!isFirst && !isLast) {
                if (rulerWidthPx > 0) {
                  const px = (data.time / duration) * rulerWidthPx;
                  for (const placedPx of placedPixelPositions) {
                    if (Math.abs(px - placedPx) < minPixelGap) {
                      canPlace = false;
                      break;
                    }
                  }
                } else {
                  const minTimeGap = fallbackMinTimeGap;
                  for (const t of placedTimes) {
                    if (Math.abs(data.time - t) < minTimeGap) {
                      canPlace = false;
                      break;
                    }
                  }
                }
              }

              if (canPlace || isFirst || isLast) {
                usedPercentageKeys.add(percentageKey);
                placedTimes.push(data.time);
                if (rulerWidthPx > 0) {
                  placedPixelPositions.push(
                    (data.time / duration) * rulerWidthPx
                  );
                }

                markers.push(
                  <div
                    key={`${data.type}-${data.time}-${index}`}
                    className={`time-marker time-marker-${data.type} ${
                      isFirst ? "first" : ""
                    } ${isLast ? "last" : ""}`}
                    style={{ left: `${(data.time / duration) * 100}%` }}
                  >
                    {data.type === "major" && (
                      <span className="time-label">
                        {formatTime(data.time)}
                      </span>
                    )}
                  </div>
                );
              }
            });

            return markers;
          })()}
        </div>
      </div>

      {/* Track Lanes */}
      <div className="tracks-container" onMouseDown={handleContainerMouseDown}>
        {/* Video Track */}
        <TrackLane
          type="video"
          name="Video Track"
          color="#8b5cf6"
          duration={duration}
          trimStart={trimStart}
          trimEnd={trimEnd}
        />

        {/* Audio Tracks */}
        {audioTracks.map((track, index) => (
          <TrackLane
            key={track.index}
            type="audio"
            name={track.name}
            color={track.color}
            duration={duration}
            trimStart={trimStart}
            trimEnd={trimEnd}
            volume={track.volume}
            isMuted={track.isMuted}
            audioBuffer={audioBuffers[index]}
            onVolumeChange={(volume) => onVolumeChange(track.index, volume)}
            onMuteToggle={() => onMuteToggle(track.index)}
          />
        ))}

        {/* Empty spacing track at bottom */}
        <div className="track-lane track-spacer">
          <div className="track-header track-header-spacer"></div>
        </div>
      </div>

      {/* Trim handles only on video track (first track) */}
      <div
        className="trim-handle-overlay trim-start"
        style={{
          left: `calc(180px + 12px + (100% - 180px - 24px) * ${
            trimStartPercentage / 100
          })`,
          top: "39px",
          height: "32px",
        }}
        onMouseDown={(e) => handleMouseDown(e, "start")}
      />

      <div
        className="trim-handle-overlay trim-end"
        style={{
          left: `calc(180px + 12px + (100% - 180px - 24px) * ${
            trimEndPercentage / 100
          })`,
          top: "39px",
          height: "32px",
        }}
        onMouseDown={(e) => handleMouseDown(e, "end")}
      />

      {/* Global playhead line that extends through all tracks */}
      <div
        className={`global-playhead-overlay ${
          isDraggingPlayhead ? "dragging" : ""
        }`}
        style={{
          left: `calc(180px + 12px + (100% - 180px - 24px) * ${
            currentPercentage / 100
          })`,
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleMouseDown(e, "playhead");
        }}
      >
        <div className="playhead-handle-top">▼</div>
      </div>
    </div>
  );
};

export default Timeline;
