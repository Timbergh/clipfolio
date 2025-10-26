import React, { useState, useEffect, useRef } from "react";
import { AudioTrack } from "../types";
import "../styles/ExportPanel.css";

const api = window.api;
const path = window.path;
const fs = window.fs;

interface ExportPanelProps {
  videoPath: string;
  videoName: string;
  trimStart: number;
  trimEnd: number;
  audioTracks: AudioTrack[];
  onClose: () => void;
}

type SizeOption = "original" | "10mb" | "25mb" | "50mb" | "100mb";

const ExportPanel: React.FC<ExportPanelProps> = ({
  videoPath,
  videoName,
  trimStart,
  trimEnd,
  audioTracks,
  onClose,
}) => {
  const [selectedSize, setSelectedSize] = useState<SizeOption>("original");
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const [processedVideoPath, setProcessedVideoPath] = useState<string | null>(
    null
  );
  const [thumbnailPath, setThumbnailPath] = useState<string | null>(null);
  const [previewThumbnailPath, setPreviewThumbnailPath] = useState<
    string | null
  >(null);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [hasStartedProcessing, setHasStartedProcessing] = useState(false);
  const [processedSizeBytes, setProcessedSizeBytes] = useState<number | null>(
    null
  );
  const [dragIconPath, setDragIconPath] = useState<string | null>(null);
  const exportTokenRef = useRef<string>("");

  type AudioMode = "combine" | "separate";
  const [audioMode, setAudioMode] = useState<AudioMode>("combine");
  type OutputType = "video" | "mp3";
  const [outputType, setOutputType] = useState<OutputType>("video");

  const sizeOptions: { value: SizeOption; label: string; sizeMB?: number }[] = [
    { value: "original", label: "Original" },
    { value: "10mb", label: "10 MB", sizeMB: 10 },
    { value: "25mb", label: "25 MB", sizeMB: 25 },
    { value: "50mb", label: "50 MB", sizeMB: 50 },
    { value: "100mb", label: "100 MB", sizeMB: 100 },
  ];

  useEffect(() => {
    const generatePreviewThumbnail = async () => {
      // Use get-cached-thumbnail which has built-in caching and defaults to 10% timestamp
      try {
        const thumb = await api.getCachedThumbnail(videoPath);
        setPreviewThumbnailPath(thumb);
      } catch (error) {
        console.error("Error getting preview thumbnail:", error);
      }
    };
    try {
      const savedSize = localStorage.getItem(
        "export.selectedSize"
      ) as SizeOption | null;
      if (
        savedSize &&
        ["original", "10mb", "25mb", "50mb", "100mb"].includes(savedSize)
      ) {
        setSelectedSize(savedSize as SizeOption);
      }
      const savedAudioMode = localStorage.getItem(
        "export.audioMode"
      ) as AudioMode | null;
      if (savedAudioMode && ["combine", "separate"].includes(savedAudioMode)) {
        setAudioMode(savedAudioMode as AudioMode);
      }
    } catch {}
    generatePreviewThumbnail();
  }, []);

  useEffect(() => {
    handleExport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If size changes, cancel current job (if any) and reprocess with new option
  useEffect(() => {
    const isMp3 = outputType === "mp3";
    if (isMp3) return; // size does not affect MP3 export
    if (!hasStartedProcessing) return;
    const restartForNewSize = async () => {
      if (isProcessing) {
        setExportStatus("Updating size...");
        // Proactively set processing state to avoid UI flashing processed view
        setHasProcessed(false);
        setProcessedVideoPath(null);
        setThumbnailPath(null);
        setExportProgress(0);
        setIsProcessing(true);
        try {
          await api.cancelExport();
        } catch {}
        setTimeout(() => {
          handleExport();
        }, 50);
      } else {
        handleExport();
      }
    };
    restartForNewSize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSize]);

  // Persist size selection
  useEffect(() => {
    try {
      localStorage.setItem("export.selectedSize", selectedSize);
    } catch {}
  }, [selectedSize]);

  // Restart when audio mode changes
  useEffect(() => {
    const isMp3 = outputType === "mp3";
    if (isMp3) return; // audio mode UI does not affect MP3 export
    if (!hasStartedProcessing) return;
    const restart = async () => {
      if (isProcessing) {
        setExportStatus("Updating audio...");
        setHasProcessed(false);
        setProcessedVideoPath(null);
        setThumbnailPath(null);
        setExportProgress(0);
        setIsProcessing(true);
        try {
          await api.cancelExport();
        } catch {}
        setTimeout(() => {
          handleExport();
        }, 50);
      } else {
        handleExport();
      }
    };
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioMode]);

  // Persist audio mode (do not persist output type)
  useEffect(() => {
    try {
      localStorage.setItem("export.audioMode", audioMode);
    } catch {}
  }, [audioMode]);

  // Restart when output type changes
  useEffect(() => {
    if (!hasStartedProcessing) return;
    const restart = async () => {
      if (isProcessing) {
        setExportStatus("Updating format...");
        setHasProcessed(false);
        setProcessedVideoPath(null);
        setThumbnailPath(null);
        setExportProgress(0);
        setIsProcessing(true);
        try {
          await api.cancelExport();
        } catch {}
        setTimeout(() => {
          handleExport();
        }, 50);
      } else {
        handleExport();
      }
    };
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputType]);

  const generateThumbnail = async (
    videoPath: string,
    timestamp?: number
  ): Promise<string> => {
    try {
      const os = window.os;
      const tempDir = os.tmpdir();
      const timestampMs = Date.now();
      const thumbnailFileName = `thumbnail_${timestampMs}.jpg`;
      const thumbnailOutputPath = path.join(tempDir, thumbnailFileName);

      // Generate thumbnail at the middle of the clip, or use provided timestamp
      const thumbTime =
        timestamp !== undefined
          ? timestamp
          : trimStart + (trimEnd - trimStart) / 2;

      await api.generateThumbnail(videoPath, thumbnailOutputPath, thumbTime);

      return thumbnailOutputPath;
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      return "";
    }
  };

  const generateWaveformImage = async (audioPath: string): Promise<string> => {
    try {
      const audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const fileBuffer = await api.readFileBuffer(audioPath);
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      );
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const width = 320;
      const height = 180;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";

      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, width, height);

      const channelData = audioBuffer.getChannelData(0);
      const samplesPerPixel = Math.max(
        1,
        Math.floor(channelData.length / width)
      );
      const midY = Math.floor(height / 2);

      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const start = x * samplesPerPixel;
        let min = 1.0;
        let max = -1.0;
        for (let i = 0; i < samplesPerPixel; i++) {
          const v = channelData[start + i] || 0;
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const y1 = midY + Math.round(min * midY);
        const y2 = midY + Math.round(max * midY);
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
      }
      ctx.stroke();

      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const buffer = window.Buffer.from(base64, "base64");
      const os = window.os;
      const tempDir = os.tmpdir();
      const outPath = path.join(tempDir, `waveform_${Date.now()}.png`);
      fs.writeFileSync(outPath, buffer);
      return outPath;
    } catch (err) {
      console.error("Error generating waveform image:", err);
      return "";
    }
  };

  const handleExport = async () => {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    exportTokenRef.current = token;
    setHasStartedProcessing(true);
    setIsProcessing(true);
    setHasProcessed(false);
    setExportProgress(0);
    setExportStatus(
      outputType === "mp3" ? "Processing audio..." : "Processing video..."
    );
    setThumbnailPath(null);
    setProcessedVideoPath(null);

    // Listen for progress updates
    const progressListener = (progress: any) => {
      if (!progress || progress.jobId !== exportTokenRef.current) return;
      if (progress.percent) {
        setExportProgress(Math.round(progress.percent));
      }
    };
    const unsubscribe = api.on("export-progress", progressListener);

    try {
      const os = window.os;
      const tempDir = os.tmpdir();
      const timestamp = Date.now();
      const outputExt = outputType === "mp3" ? ".mp3" : path.extname(videoName);
      const outputFileName = `export_${timestamp}${outputExt}`;
      const outputPath = path.join(tempDir, outputFileName);

      // Determine quality and target size
      const selectedOption = sizeOptions.find(
        (opt) => opt.value === selectedSize
      );
      const quality = selectedSize === "original" ? "full" : "compressed";
      const targetSizeMB =
        outputType === "mp3" ? undefined : selectedOption?.sizeMB;

      // Export the video
      const result = await api.exportVideo(
        videoPath,
        outputPath,
        trimStart,
        trimEnd,
        quality,
        audioTracks,
        targetSizeMB,
        token,
        audioMode,
        outputType
      );
      if (
        result &&
        typeof result === "object" &&
        (result as any).status === "canceled"
      ) {
        throw new Error("canceled");
      }

      // Generate preview image: waveform for MP3, thumbnail for video
      const thumb =
        outputType === "mp3"
          ? await generateWaveformImage(outputPath)
          : await generateThumbnail(
              videoPath,
              trimStart + (trimEnd - trimStart) / 2
            );

      if (token === exportTokenRef.current) {
        setProcessedVideoPath(outputPath);
        setThumbnailPath(thumb);
        try {
          const stat = fs.statSync(outputPath);
          setProcessedSizeBytes(stat.size);
        } catch {}
        setExportStatus(outputType === "mp3" ? "Audio ready!" : "Video ready!");
        setExportProgress(100);
        setHasProcessed(true);
        setIsProcessing(false);
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      if (/canceled/i.test(errorMsg)) {
        // Silent cancel (likely due to size change or closing panel)
        // Keep isProcessing true so UI stays on placeholder until next run starts
        setExportProgress(0);
      } else {
        setExportStatus(`Export failed: ${errorMsg.substring(0, 50)}...`);
        setTimeout(() => {
          setIsProcessing(false);
          setExportStatus("");
          setExportProgress(0);
        }, 5000);
      }
    } finally {
      // Clean up listener in all cases to avoid duplicates
      if (unsubscribe) unsubscribe();
    }
  };

  const handleDownload = async () => {
    if (!processedVideoPath) return;

    try {
      const selectedOption = sizeOptions.find(
        (opt) => opt.value === selectedSize
      );
      const defaultPath = path.join(
        path.dirname(videoPath),
        outputType === "mp3"
          ? `${path.basename(videoName, path.extname(videoName))}_${
              selectedOption?.label
            }.mp3`
          : `${path.basename(videoName, path.extname(videoName))}_${
              selectedOption?.label
            }${path.extname(videoName)}`
      );

      const filters =
        outputType === "mp3"
          ? [{ name: "Audio", extensions: ["mp3"] }]
          : [{ name: "Videos", extensions: ["mp4", "mov", "avi", "mkv"] }];

      const result = await api.selectSaveLocation(defaultPath, filters);

      if (!result.canceled && result.filePath) {
        // Copy the temporary file to the selected location
        fs.copyFileSync(processedVideoPath, result.filePath);

        // Show brief success message
        setExportStatus("Downloaded successfully!");
        setTimeout(() => {
          setExportStatus("");
        }, 2000);
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      setExportStatus(`Download failed: ${errorMsg.substring(0, 50)}...`);
      setTimeout(() => {
        setExportStatus("");
      }, 3000);
    }
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (!processedVideoPath) return;

    // Left click only
    if (e.button !== 0) return;

    try {
      let iconPathToUse = dragIconPath || null;
      if (!iconPathToUse && thumbnailPath) {
        try {
          iconPathToUse = await createSquareDragIcon(thumbnailPath);
          setDragIconPath(iconPathToUse);
        } catch {}
      }
      await api.startDrag({
        filePath: processedVideoPath,
        iconPath: iconPathToUse || undefined,
      });
    } catch (err) {
      console.error("Error starting drag:", err);
    }
  };

  const preventImageDrag = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getTrimDuration = (): string => {
    const duration = trimEnd - trimStart;
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatBytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    if (kb >= 1) return `${Math.max(1, Math.round(kb))} KB`;
    return `${bytes} B`;
  };

  const createSquareDragIcon = (sourceImagePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            const size = 256;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Canvas context not available"));

            ctx.clearRect(0, 0, size, size);
            const scale = Math.min(size / img.width, size / img.height);
            const drawW = Math.round(img.width * scale);
            const drawH = Math.round(img.height * scale);
            const dx = Math.round((size - drawW) / 2);
            const dy = Math.round((size - drawH) / 2);
            ctx.drawImage(img, dx, dy, drawW, drawH);

            const dataUrl = canvas.toDataURL("image/png");
            const base64 = dataUrl.split(",")[1];
            const buffer = window.Buffer.from(base64, "base64");
            const os = window.os;
            const tempDir = os.tmpdir();
            const outPath = path.join(tempDir, `drag_icon_${Date.now()}.png`);
            fs.writeFile(outPath, buffer, (err: any) => {
              if (err) return reject(err);
              resolve(outPath);
            });
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = (e) =>
          reject(new Error("Failed to load thumbnail for icon"));
        img.src = window.path.toLocalURL(sourceImagePath);
      } catch (error) {
        reject(error);
      }
    });
  };

  return (
    <div className="export-panel">
      <h3>Choose a File Size</h3>

      {/* Size selection radio buttons */}
      <div className="size-selection">
        <div className="size-options">
          {sizeOptions.map((option, index) => (
            <label
              key={option.value}
              className={`size-option ${
                selectedSize === option.value ? "selected" : ""
              } ${
                index === 0
                  ? "first"
                  : index === sizeOptions.length - 1
                  ? "last"
                  : ""
              } ${outputType === "mp3" ? "disabled" : ""}`}
            >
              <input
                type="radio"
                name="size"
                value={option.value}
                checked={selectedSize === option.value}
                onChange={() => setSelectedSize(option.value)}
                disabled={outputType === "mp3"}
              />
              <div className="size-option-content">
                <span className="size-label">{option.label}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Audio output options */}
      <div className="size-selection" style={{ marginTop: 8 }}>
        <div className="size-options">
          <label
            className={`size-option ${
              audioMode === "combine" ? "selected" : ""
            } first ${outputType === "mp3" ? "disabled" : ""}`}
          >
            <input
              type="radio"
              name="audioMode"
              value="combine"
              checked={audioMode === "combine"}
              onChange={() => setAudioMode("combine")}
              disabled={outputType === "mp3"}
            />
            <div className="size-option-content">
              <span className="size-label">Combine audio tracks</span>
            </div>
          </label>
          <label
            className={`size-option ${
              audioMode === "separate" ? "selected" : ""
            } last ${outputType === "mp3" ? "disabled" : ""}`}
          >
            <input
              type="radio"
              name="audioMode"
              value="separate"
              checked={audioMode === "separate"}
              onChange={() => setAudioMode("separate")}
              disabled={outputType === "mp3"}
            />
            <div className="size-option-content">
              <span className="size-label">Keep tracks separate</span>
            </div>
          </label>
        </div>
      </div>

      {/* Output format selection */}
      <div className="size-selection" style={{ marginTop: 8 }}>
        <div className="size-options">
          <label
            className={`size-option ${
              outputType === "video" ? "selected" : ""
            } first`}
          >
            <input
              type="radio"
              name="outputType"
              value="video"
              checked={outputType === "video"}
              onChange={() => setOutputType("video")}
            />
            <div className="size-option-content">
              <span className="size-label">MP4 (video)</span>
            </div>
          </label>
          <label
            className={`size-option ${
              outputType === "mp3" ? "selected" : ""
            } last`}
          >
            <input
              type="radio"
              name="outputType"
              value="mp3"
              checked={outputType === "mp3"}
              onChange={() => setOutputType("mp3")}
            />
            <div className="size-option-content">
              <span className="size-label">MP3 (audio only)</span>
            </div>
          </label>
        </div>
      </div>

      {/* Preview thumbnail (always shown) */}
      <div className="video-preview-container">
        {isProcessing ? (
          <div className="processing-placeholder">
            <div className="processing-text">
              <span className="processing-label">Preparing your clip</span>
              <span className="processing-percentage">
                {exportProgress}% complete
              </span>
            </div>
            <div className="processing-spinner-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        ) : processedVideoPath ? (
          <>
            <div className="drag-drop-area">
              <div className="video-thumbnail" onMouseDown={handleMouseDown}>
                {thumbnailPath ? (
                  <img
                    src={window.path.toLocalURL(thumbnailPath)}
                    alt="Video thumbnail"
                    className="thumbnail-image"
                    draggable={false}
                    onDragStart={preventImageDrag}
                  />
                ) : (
                  <div className="thumbnail-placeholder">
                    <span>No preview available</span>
                  </div>
                )}
                {processedSizeBytes != null && (
                  <div className="clip-size-badge">
                    {formatBytes(processedSizeBytes)}
                  </div>
                )}
                <div className="clip-duration-badge">{getTrimDuration()}</div>
                <div className="drag-overlay">
                  <div className="drag-overlay-content">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="drag-overlay-text">
                      <div className="drag-title">Drag & drop</div>
                      <div className="drag-subtitle">
                        Grab & drag clip to share it
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="drag-drop-subtitle">
                Drag this clip into any app that supports file uploads or
                download it to your device
              </div>
            </div>

            <button className="download-btn" onClick={handleDownload}>
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
                <path d="M12 15V3" />
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5" />
              </svg>
              Download
            </button>

            {exportStatus && <p className="status-message">{exportStatus}</p>}
          </>
        ) : (
          <div className="preview-thumbnail-container">
            <div className="video-thumbnail preview-only">
              {previewThumbnailPath ? (
                <img
                  src={window.path.toLocalURL(previewThumbnailPath)}
                  alt="Video preview"
                  className="thumbnail-image"
                />
              ) : (
                <div className="thumbnail-placeholder">
                  <span>Loading preview...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* No continue button; processing starts automatically */}
    </div>
  );
};

export default ExportPanel;
