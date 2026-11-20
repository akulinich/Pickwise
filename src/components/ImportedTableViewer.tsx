import { useEffect, useMemo, useState } from "react";
import { classIconUrl } from "../domain/model";
import type { ImportedSnapshot } from "../storage/importedMatchups";
import { formatProbabilityInput, matchupInputColor } from "../utils/format";

interface ImportedTableViewerProps {
  snapshot: ImportedSnapshot;
  selectedRowIds: readonly string[];
  selectedColumnIds: readonly string[];
  onClose(): void;
}

export function ImportedTableViewer({
  snapshot,
  selectedRowIds,
  selectedColumnIds,
  onClose,
}: ImportedTableViewerProps) {
  const availableDeckIds = new Set(snapshot.decks.map((deck) => deck.id));
  const [selectedRows, setSelectedRows] = useState<Set<string>>(
    () => new Set(selectedRowIds.filter((id) => availableDeckIds.has(id))),
  );
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(selectedColumnIds.filter((id) => availableDeckIds.has(id))),
  );
  const [showSelectedRows, setShowSelectedRows] = useState(false);
  const [showSelectedColumns, setShowSelectedColumns] = useState(false);

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
  const visibleRows = showSelectedRows
    ? snapshot.decks.filter((deck) => selectedRows.has(deck.id))
    : snapshot.decks;
  const visibleColumns = showSelectedColumns
    ? snapshot.decks.filter((deck) => selectedColumns.has(deck.id))
    : snapshot.decks;

  const toggleRow = (deckId: string) => {
    const next = new Set(selectedRows);
    if (next.has(deckId)) next.delete(deckId);
    else next.add(deckId);
    setSelectedRows(next);
    if (next.size === 0) setShowSelectedRows(false);
  };

  const toggleColumn = (deckId: string) => {
    const next = new Set(selectedColumns);
    if (next.has(deckId)) next.delete(deckId);
    else next.add(deckId);
    setSelectedColumns(next);
    if (next.size === 0) setShowSelectedColumns(false);
  };

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

        <div className="imported-table-toolbar">
          <p>Select row and column headers to compare decks.</p>
          <div className="imported-table-filters" aria-label="Table visibility filters">
            <button
              className="table-filter-toggle"
              type="button"
              aria-pressed={showSelectedRows}
              disabled={selectedRows.size === 0}
              onClick={() => setShowSelectedRows((current) => !current)}
            >
              <span className="table-filter-switch" aria-hidden="true" />
              Show selected rows
              {selectedRows.size > 0 && <span className="table-filter-count">{selectedRows.size}</span>}
            </button>
            <button
              className="table-filter-toggle"
              type="button"
              aria-pressed={showSelectedColumns}
              disabled={selectedColumns.size === 0}
              onClick={() => setShowSelectedColumns((current) => !current)}
            >
              <span className="table-filter-switch" aria-hidden="true" />
              Show selected columns
              {selectedColumns.size > 0 && <span className="table-filter-count">{selectedColumns.size}</span>}
            </button>
          </div>
        </div>

        <div className="imported-table-scroll">
          <table className="imported-matchup-table">
            <thead>
              <tr>
                <th className="imported-table-corner" scope="col">Your deck ↓ / Opponent →</th>
                {visibleColumns.map((deck) => (
                  <th
                    scope="col"
                    key={deck.id}
                    className={selectedColumns.has(deck.id) ? "axis-selected" : undefined}
                  >
                    <button
                      className="imported-table-axis-button"
                      type="button"
                      aria-label={`Select column ${deck.name}`}
                      aria-pressed={selectedColumns.has(deck.id)}
                      onClick={() => toggleColumn(deck.id)}
                    >
                      <img src={classIconUrl(deck.classId)} alt="" />
                      <span>{deck.name}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((deck) => (
                <tr key={deck.id} className={selectedRows.has(deck.id) ? "axis-selected" : undefined}>
                  <th scope="row" className={selectedRows.has(deck.id) ? "axis-selected" : undefined}>
                    <button
                      className="imported-table-axis-button"
                      type="button"
                      aria-label={`Select row ${deck.name}`}
                      aria-pressed={selectedRows.has(deck.id)}
                      onClick={() => toggleRow(deck.id)}
                    >
                      <img src={classIconUrl(deck.classId)} alt="" />
                      <span>{deck.name}</span>
                    </button>
                  </th>
                  {visibleColumns.map((opponent) => {
                    const cell = cells.get(`${deck.id}\u0000${opponent.id}`);
                    const selectionClasses = [
                      cell ? "" : "missing",
                      selectedRows.has(deck.id) ? "selected-row-cell" : "",
                      selectedColumns.has(opponent.id) ? "selected-column-cell" : "",
                    ].filter(Boolean).join(" ");
                    return (
                      <td
                        key={opponent.id}
                        className={selectionClasses}
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
