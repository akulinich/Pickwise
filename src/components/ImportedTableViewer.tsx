import { useEffect, useMemo } from "react";
import { classIconUrl } from "../domain/model";
import type { ImportedSnapshot } from "../storage/importedMatchups";
import { formatProbabilityInput, matchupInputColor } from "../utils/format";

interface ImportedTableViewerProps {
  snapshot: ImportedSnapshot;
  onClose(): void;
}

export function ImportedTableViewer({ snapshot, onClose }: ImportedTableViewerProps) {
  useEffect(() => {
    document.body.classList.add("modal-open");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const cells = useMemo(
    () => new Map(
      snapshot.matchups.map((cell) => [
        `${cell.deckId}\u0000${cell.opponentDeckId}`,
        cell,
      ]),
    ),
    [snapshot],
  );

  return (
    <div
      className="imported-table-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="imported-table-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="imported-table-title"
      >
        <div className="imported-table-header">
          <div>
            <p className="eyebrow">{snapshot.source} · {snapshot.rank} · {snapshot.period}</p>
            <h2 id="imported-table-title">Imported matchup table</h2>
            <p>
              {snapshot.decks.length} decks · {snapshot.matchups.length} captured cells · {new Date(snapshot.capturedAt).toLocaleString()}
            </p>
          </div>
          <button className="icon-button" type="button" aria-label="Close imported table" onClick={onClose}>×</button>
        </div>

        <div className="imported-table-scroll">
          <table className="imported-matchup-table">
            <thead>
              <tr>
                <th className="imported-table-corner" scope="col">Your deck ↓ / Opponent →</th>
                {snapshot.decks.map((deck) => (
                  <th scope="col" key={deck.id}>
                    <span className="imported-table-deck">
                      <img src={classIconUrl(deck.classId)} alt="" />
                      <span>{deck.name}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshot.decks.map((deck) => (
                <tr key={deck.id}>
                  <th scope="row">
                    <span className="imported-table-deck">
                      <img src={classIconUrl(deck.classId)} alt="" />
                      <span>{deck.name}</span>
                    </span>
                  </th>
                  {snapshot.decks.map((opponent) => {
                    const cell = cells.get(`${deck.id}\u0000${opponent.id}`);
                    return (
                      <td
                        key={opponent.id}
                        className={cell ? "" : "missing"}
                        style={cell ? { background: matchupInputColor(cell.winRate) } : undefined}
                        title={cell ? `${cell.games.toLocaleString()} games` : "Not captured"}
                      >
                        {cell ? (
                          <>
                            <strong>{formatProbabilityInput(cell.winRate)}%</strong>
                            <span>{cell.games.toLocaleString()} games</span>
                          </>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
