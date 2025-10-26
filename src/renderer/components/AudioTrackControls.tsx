import React from 'react';
import { AudioTrack } from '../types';
import '../styles/AudioTrackControls.css';

interface AudioTrackControlsProps {
  audioTracks: AudioTrack[];
  onVolumeChange: (trackIndex: number, volume: number) => void;
}

const AudioTrackControls: React.FC<AudioTrackControlsProps> = ({
  audioTracks,
  onVolumeChange
}) => {
  return (
    <div className="audio-track-controls">
      <h3>Audio Tracks</h3>

      {audioTracks.length === 0 ? (
        <p className="no-tracks">No audio tracks found</p>
      ) : (
        <div className="tracks-list">
          {audioTracks.map((track) => (
            <div key={track.index} className="track-item">
              <div className="track-header">
                <span className="track-name">{track.name}</span>
                <span className="track-volume-value">
                  {Math.round(track.volume * 100)}%
                </span>
              </div>

              <div className="track-controls">
                <span className="volume-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/>
                    <path d="M16 9a5 5 0 0 1 0 6"/>
                    <path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>
                  </svg>
                </span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={track.volume}
                  onChange={(e) =>
                    onVolumeChange(track.index, parseFloat(e.target.value))
                  }
                  className="volume-slider"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioTrackControls;
