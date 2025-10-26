export interface VideoFile {
  name: string;
  path: string;
  size: number;
  created: Date;
  modified: Date;
  duration?: number;
  thumbnail?: string;
  folderPath?: string;
  relativePath?: string;
}

export interface VideoMetadata {
  format: {
    duration?: number;
    size?: number;
    bit_rate?: number;
  };
  streams: Array<{
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
    duration?: number;
    bit_rate?: number;
    channels?: number;
    sample_rate?: number;
    tags?: {
      title?: string;
      language?: string;
    };
  }>;
}

export interface AudioTrack {
  index: number;
  name: string;
  volume: number;
  color: string;
  isMuted: boolean;
}

export type SortBy = 'name' | 'date' | 'size';
export type SortOrder = 'asc' | 'desc';

// Clip edits and favorites
export interface AudioTrackEdit {
  index: number;
  volume: number;
  isMuted: boolean;
}

export interface ClipEdits {
  trimStart?: number;
  trimEnd?: number;
  audioTracks?: AudioTrackEdit[];
}

export interface VideoFileWithMetadata extends VideoFile {
  contentHash?: string;
  isFavorite?: boolean;
  edits?: ClipEdits;
}
