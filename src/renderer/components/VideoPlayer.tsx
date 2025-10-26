import React, { useEffect, useRef } from "react";
import {
  VideoColorSampler,
  ColorRGB,
  MultiZoneColors,
} from "../utils/colorSampler";
import "../styles/VideoPlayer.css";

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoPath: string;
  isPlaying: boolean;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onEnded: () => void;
  onColorChange?: (colors: MultiZoneColors) => void;
  playerRef?: React.RefObject<HTMLDivElement | null>;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoRef,
  videoPath,
  isPlaying,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onColorChange,
  playerRef,
}) => {
  const internalPlayerRef = useRef<HTMLDivElement>(null);
  const actualPlayerRef = playerRef || internalPlayerRef;
  const samplerRef = useRef<VideoColorSampler | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    samplerRef.current = new VideoColorSampler();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!onColorChange) return;

    let intervalId: NodeJS.Timeout;
    let sampleCount = 0;

    const sampleColors = () => {
      if (videoRef.current && samplerRef.current) {
        try {
          const colors = samplerRef.current.sampleMultiZoneColors(
            videoRef.current
          );
          onColorChange(colors);
          sampleCount++;
          if (sampleCount % 10 === 0) {
            console.log("🎨 Sample", sampleCount, "colors:", colors.average);
          }
        } catch (error) {
          console.error("Error sampling colors:", error);
        }
      }
    };

    intervalId = setInterval(sampleColors, 100);

    setTimeout(sampleColors, 100);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [videoRef, onColorChange]);

  const handleVideoLoad = () => {
    onLoadedMetadata();

    const attemptSample = (attempts = 0) => {
      if (attempts > 10) return;

      setTimeout(() => {
        if (videoRef.current && samplerRef.current && onColorChange) {
          const colors = samplerRef.current.sampleMultiZoneColors(
            videoRef.current
          );
          onColorChange(colors);

          if (
            colors.average.r === 15 &&
            colors.average.g === 15 &&
            colors.average.b === 15 &&
            attempts < 5
          ) {
            attemptSample(attempts + 1);
          }
        }
      }, 50 * (attempts + 1));
    };

    attemptSample();
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    console.error("[VideoPlayer] Video error:", {
      error: video.error,
      code: video.error?.code,
      message: video.error?.message,
      networkState: video.networkState,
      readyState: video.readyState,
      src: video.src,
    });
  };

  return (
    <div className="video-player" ref={actualPlayerRef}>
      <video
        ref={videoRef}
        src={window.path.toLocalURL(videoPath)}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={handleVideoLoad}
        onEnded={onEnded}
        onError={handleError}
        controls={false}
        muted={true}
        crossOrigin="anonymous"
      />
    </div>
  );
};

export default VideoPlayer;
