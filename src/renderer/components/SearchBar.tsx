import React, { useEffect, useRef, useState } from "react";
import { SortBy, SortOrder } from "../types";
import { useGlowEffect } from "../hooks/useGlowEffect";
import "../styles/SearchBar.css";
import "../styles/GlowWrapper.css";

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize glow effect system
  useGlowEffect();

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

  return (
    <div className="search-bar" data-glow>
      <div className="search-input-wrapper">
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
          className={`sort-toggle ${isOpen ? "open" : ""}`}
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
