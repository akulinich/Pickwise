import { useEffect, useRef, useState } from "react";
import type { SavedMatch } from "../storage/savedMatches";

interface MatchPickerProps {
  name: string;
  savedMatches: SavedMatch[];
  activeSavedMatchId: string;
  onNameChange(name: string): void;
  onLoad(id: string): void;
  onDelete(id: string): void;
}

export function MatchPicker({
  name,
  savedMatches,
  activeSavedMatchId,
  onNameChange,
  onLoad,
  onDelete,
}: MatchPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return (
    <div
      className="match-picker"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <label htmlFor="match-name">Match name</label>
      <div className="match-picker-input">
        <input
          id="match-name"
          value={name}
          maxLength={64}
          autoComplete="off"
          onChange={(event) => onNameChange(event.target.value)}
        />
        <button
          className="match-picker-toggle"
          type="button"
          aria-label="Open saved matches"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="saved-match-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="saved-match-menu" id="saved-match-menu" role="menu">
          {savedMatches.length === 0 ? (
            <p>No saved matches yet</p>
          ) : (
            savedMatches.map((match) => (
              <div
                className={match.id === activeSavedMatchId ? "saved-match-item active" : "saved-match-item"}
                key={match.id}
              >
                <button
                  className="saved-match-name"
                  type="button"
                  role="menuitem"
                  aria-current={match.id === activeSavedMatchId ? "true" : undefined}
                  onClick={() => {
                    setOpen(false);
                    onLoad(match.id);
                  }}
                >
                  {match.name}
                </button>
                <button
                  className="saved-match-delete"
                  type="button"
                  aria-label={`Delete ${match.name}`}
                  title={`Delete ${match.name}`}
                  onClick={() => onDelete(match.id)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m4 4 8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

