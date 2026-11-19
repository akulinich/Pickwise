import { useRef, useState } from "react";
import { ClassPicker } from "./ClassPicker";
import { ImportedDeckPicker } from "./ImportedDeckPicker";
import { ImporterGuide } from "./ImporterGuide";
import { MatchPicker } from "./MatchPicker";
import { deckName, type SolverInput } from "../domain/model";
import type { ImportedSnapshot } from "../storage/importedMatchups";
import type { SavedMatch } from "../storage/savedMatches";
import { formatProbabilityInput, matchupInputColor } from "../utils/format";

interface SetupPanelProps {
  input: SolverInput;
  errors: string[];
  calculating: boolean;
  savedMatches: SavedMatch[];
  activeSavedMatchId: string;
  storageMessage: string;
  storageMessageIsError: boolean;
  importedSnapshots: ImportedSnapshot[];
  importedSnapshot: ImportedSnapshot | null;
  importMessage: string;
  importMessageIsError: boolean;
  onChange(next: SolverInput): void;
  onCalculate(): void;
  onLoadSavedMatch(id: string): void;
  onDeleteSavedMatch(id: string): void;
  onNewMatch(): void;
  onImportCsv(file: File): void;
  onSourceChange(source: SolverInput["dataSource"]): void;
  onImportedSnapshotChange(snapshotId: string): void;
  onImportedDeckChange(side: "mine" | "opponent", index: number, deckId: string): void;
}

export function SetupPanel({
  input,
  errors,
  calculating,
  savedMatches,
  activeSavedMatchId,
  storageMessage,
  storageMessageIsError,
  importedSnapshots,
  importedSnapshot,
  importMessage,
  importMessageIsError,
  onChange,
  onCalculate,
  onLoadSavedMatch,
  onDeleteSavedMatch,
  onNewMatch,
  onImportCsv,
  onSourceChange,
  onImportedSnapshotChange,
  onImportedDeckChange,
}: SetupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImporterGuide, setShowImporterGuide] = useState(false);
  const setMatrixValue = (row: number, column: number, raw: string) => {
    const next = input.matrix.map((values) => [...values]);
    next[row][column] = raw === "" ? Number.NaN : Number(raw);
    onChange({ ...input, matrix: next });
  };

  const setMyClass = (index: number, classId: SolverInput["myDecks"][number]["classId"]) => {
    const myDecks = input.myDecks.map((deck, deckIndex) =>
      deckIndex === index ? { classId } : deck,
    );
    onChange({ ...input, myDecks });
  };

  const setOpponentClass = (
    index: number,
    classId: SolverInput["opponentDecks"][number]["classId"],
  ) => {
    const opponentDecks = input.opponentDecks.map((deck, deckIndex) =>
      deckIndex === index ? { classId } : deck,
    );
    onChange({ ...input, opponentDecks });
  };

  return (
    <section className="setup-shell" aria-labelledby="setup-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Match setup</p>
          <h2 id="setup-heading">Build the field</h2>
        </div>
        <div className="match-controls">
          <div className="match-control-row">
            <MatchPicker
              name={input.eventName}
              savedMatches={savedMatches}
              activeSavedMatchId={activeSavedMatchId}
              onNameChange={(eventName) => onChange({ ...input, eventName })}
              onLoad={onLoadSavedMatch}
              onDelete={onDeleteSavedMatch}
            />
            <button
              className="secondary-button new-match-button"
              type="button"
              disabled={calculating}
              onClick={onNewMatch}
            >
              New match
            </button>
          </div>
          {storageMessage && (
            <p
              className={
                storageMessageIsError
                  ? "match-storage-message error"
                  : "match-storage-message"
              }
              role={storageMessageIsError ? "alert" : "status"}
            >
              {storageMessage}
            </p>
          )}
        </div>
      </div>

      <div className="data-source-bar">
        <label className="data-source-select">
          <span>Matchup data source</span>
          <select
            value={input.dataSource}
            onChange={(event) => onSourceChange(event.target.value as SolverInput["dataSource"])}
          >
            <option value="none">No source</option>
            <option value="imported" disabled={importedSnapshots.length === 0}>
              {importedSnapshots.length > 0 ? "Imported" : "Imported · import CSV first"}
            </option>
          </select>
        </label>
        {input.dataSource === "imported" && importedSnapshots.length > 0 && (
          <label className="data-source-select imported-snapshot-select">
            <span>Imported dataset</span>
            <select
              value={importedSnapshot?.id ?? ""}
              onChange={(event) => onImportedSnapshotChange(event.target.value)}
            >
              {!importedSnapshot && <option value="">Saved dataset is not available</option>}
              {importedSnapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.source} · {new Date(snapshot.capturedAt).toLocaleString()} · {snapshot.rank} · {snapshot.period}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="data-source-actions">
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose matchup CSV"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImportCsv(file);
              event.target.value = "";
            }}
          />
          <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
            Import CSV
          </button>
          <button className="text-button importer-help-button" type="button" onClick={() => setShowImporterGuide(true)}>
            Get importer
          </button>
        </div>
        <div className="data-source-status">
          {importedSnapshot && input.dataSource === "imported" && (
            <span>
              {importedSnapshot.decks.length} decks · {importedSnapshot.rank} · {importedSnapshot.period}
            </span>
          )}
          {importMessage && (
            <span className={importMessageIsError ? "error" : ""} role={importMessageIsError ? "alert" : "status"}>
              {importMessage}
            </span>
          )}
        </div>
      </div>

      <div className="matrix-card">
        <div className="matrix-title-row">
          <div>
            <p className="eyebrow">Single-game win rate</p>
            <h3>Your decks in rows · opponent decks in columns</h3>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() =>
              onChange({ ...input, matrix: Array.from({ length: 4 }, () => Array(4).fill(50)) })
            }
          >
            Reset to 50%
          </button>
        </div>
        <div className="matrix-scroll">
          <table className="input-matrix">
            <thead>
              <tr>
                <th className="matrix-corner">Your ↓ / Opponent →</th>
                {input.opponentDecks.map((deck, index) => (
                  <th key={`opponent-${index}`} scope="col">
                    {input.dataSource === "imported" && importedSnapshot ? (
                      <ImportedDeckPicker
                        value={deck.importedId ?? ""}
                        label={`Opponent deck ${index + 1}`}
                        decks={importedSnapshot.decks}
                        onChange={(deckId) => onImportedDeckChange("opponent", index, deckId)}
                      />
                    ) : (
                      <ClassPicker
                        value={deck.classId}
                        label={`Opponent deck ${index + 1} class`}
                        onChange={(classId) => setOpponentClass(index, classId)}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {input.myDecks.map((deck, row) => (
                <tr key={`mine-${row}`}>
                  <th scope="row">
                    {input.dataSource === "imported" && importedSnapshot ? (
                      <ImportedDeckPicker
                        value={deck.importedId ?? ""}
                        label={`Your deck ${row + 1}`}
                        decks={importedSnapshot.decks}
                        onChange={(deckId) => onImportedDeckChange("mine", row, deckId)}
                      />
                    ) : (
                      <ClassPicker
                        value={deck.classId}
                        label={`Your deck ${row + 1} class`}
                        onChange={(classId) => setMyClass(row, classId)}
                      />
                    )}
                  </th>
                  {input.opponentDecks.map((opponentDeck, column) => (
                    <td
                      key={`${row}-${column}`}
                      style={{ background: matchupInputColor(input.matrix[row][column]) }}
                    >
                      <label className="percent-input">
                        <span className="sr-only">
                          {deckName(deck)} win rate against {deckName(opponentDeck)}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          inputMode="decimal"
                          value={
                            Number.isFinite(input.matrix[row][column])
                              ? formatProbabilityInput(input.matrix[row][column])
                              : ""
                          }
                          onChange={(event) => setMatrixValue(row, column, event.target.value)}
                        />
                        <span>%</span>
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="calculate-row">
        <div className="calculate-action">
          {errors.length > 0 && (
            <div className="validation-summary" role="alert">
              {errors[0]}
              {errors.length > 1 && ` (+${errors.length - 1} more)`}
            </div>
          )}
          <button
            className="primary-button"
            type="button"
            disabled={calculating}
            onClick={onCalculate}
          >
            {calculating ? "Solving…" : "Calculate strategy"}
          </button>
        </div>
      </div>
      {showImporterGuide && <ImporterGuide onClose={() => setShowImporterGuide(false)} />}
    </section>
  );
}

