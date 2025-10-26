import React, { useEffect, useRef, useState } from "react";
import { SortBy, SortOrder } from "../types";
import "../styles/SearchBar.css";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortBy;
  onSortByChange: (sortBy: SortBy) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (sortOrder: SortOrder) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHover, setIsHover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sortOptions: Array<{
    label: string;
    sortBy: SortBy;
    sortOrder: SortOrder;
  }> = [
    { label: "Date — Newest first", sortBy: "date", sortOrder: "desc" },
    { label: "Date — Oldest first", sortBy: "date", sortOrder: "asc" },
    { label: "Name — A–Z", sortBy: "name", sortOrder: "asc" },
    { label: "Name — Z–A", sortBy: "name", sortOrder: "desc" },
    { label: "Size — Largest first", sortBy: "size", sortOrder: "desc" },
    { label: "Size — Smallest first", sortBy: "size", sortOrder: "asc" },
  ];

  const currentLabel = (() => {
    const found = sortOptions.find(
      (o) => o.sortBy === sortBy && o.sortOrder === sortOrder
    );
    return found ? found.label : `${sortBy} — ${sortOrder}`;
  })();

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const root = containerRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    root.style.setProperty("--mx", `${x}%`);
    root.style.setProperty("--my", `${y}%`);
  };

  return (
    <div
      ref={containerRef}
      className={`search-bar ${isHover ? "is-hover" : ""}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <div className="search-input-wrapper glow-target">
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
          className="search-icon"
        >
          <path d="m21 21-4.34-4.34" />
          <circle cx="11" cy="11" r="8" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search clips..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="sort-controls" ref={dropdownRef}>
        <button
          className={`sort-toggle glow-target ${isOpen ? "open" : ""}`}
          onClick={() => setIsOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          type="button"
        >
          <span className="sort-toggle-label">{currentLabel}</span>
          <span className="sort-toggle-arrow">
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
              className="sort-toggle-arrow-icon"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        {isOpen && (
          <div className="sort-menu" role="listbox">
            {sortOptions.map((opt) => {
              const active =
                opt.sortBy === sortBy && opt.sortOrder === sortOrder;
              return (
                <button
                  key={`${opt.sortBy}-${opt.sortOrder}`}
                  className={`sort-item ${active ? "active" : ""}`}
                  role="option"
                  aria-selected={active}
                  type="button"
                  onClick={() => {
                    onSortByChange(opt.sortBy);
                    onSortOrderChange(opt.sortOrder);
                    setIsOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
