import React from "react";
import "../styles/WindowControls.css";

const api = window.api;

const WindowControls: React.FC = () => {
  const handleMinimize = () => api.window.minimize();
  const handleMaximize = () => api.window.maximize();
  const handleClose = () => api.window.close();

  return (
    <div className="window-controls" aria-label="Window controls">
      <button
        className="win-btn win-min no-drag"
        onClick={handleMinimize}
        title="Minimize"
        aria-label="Minimize"
      >
        <svg
          className="win-control-icons"
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
          <path d="M5 12h14" />
        </svg>
      </button>
      <button
        className="win-btn win-max no-drag"
        onClick={handleMaximize}
        title="Maximize"
        aria-label="Maximize"
      >
        <svg
          className="win-control-icons"
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
          <rect width="18" height="18" x="3" y="3" rx="2" />
        </svg>
      </button>
      <button
        className="win-btn win-close no-drag"
        onClick={handleClose}
        title="Close"
        aria-label="Close"
      >
        <svg
          className="win-control-icons"
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
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
};

export default WindowControls;
