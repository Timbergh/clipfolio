import React, { useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import LibraryView from "./views/LibraryView";
import EditorView from "./views/EditorView";
import "./styles/App.css";

// Component to show overlay on navigation
const NavigationOverlay: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Show overlay immediately on navigation
    if ((window as any).__showOverlay) {
      (window as any).__showOverlay();
    }

    // Hide after a very brief moment to allow new page to render
    // The new page's loading screen will take over seamlessly
    const timer = setTimeout(() => {
      if ((window as any).__hideOverlay) {
        (window as any).__hideOverlay();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [location]);

  return null;
};

const App: React.FC = () => {
  // Note: Page unload handlers are already set up in the inline script in index.html

  return (
    <Router>
      <NavigationOverlay />
      <div className="app">
        <Routes>
          <Route path="/" element={<LibraryView />} />
          <Route path="/editor" element={<EditorView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
