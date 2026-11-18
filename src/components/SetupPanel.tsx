import { ClassPicker } from "./ClassPicker";
import { className, type SolverInput } from "../domain/model";
import type { SavedMatch } from "../storage/savedMatches";
import { formatProbabilityInput } from "../utils/format";

interface SetupPanelProps {
  input: SolverInput;
  errors: string[];
  calculating: boolean;
  savedMatches: SavedMatch[];
  selectedSavedMatchId: string;
  storageMessage: string;
  storageMessageIsError: boolean;
  onChange(next: SolverInput): void;
  onCalculate(): void;
  onSelectedSavedMatch(id: string): void;
  onLoadSavedMatch(): void;
  onDeleteSavedMatch(): void;
}

export function SetupPanel({
  input,
  errors,
  calculating,
  savedMatches,
  selectedSavedMatchId,
  storageMessage,
  storageMessageIsError,
  onChange,
  onCalculate,
  onSelectedSavedMatch,
  onLoadSavedMatch,
  onDeleteSavedMatch,
}: SetupPanelProps) {
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
        <label className="event-field">
          <span>Sheet title</span>
          <input
            value={input.eventName}
            maxLength={64}
            onChange={(event) => onChange({ ...input, eventName: event.target.value })}
          />
        </label>
      </div>

      <div className="saved-matches-bar" aria-label="Saved calculations">
        <label className="saved-match-field">
          <span>Saved calculations</span>
          <select
            aria-label="Saved calculations"
            value={selectedSavedMatchId}
            disabled={savedMatches.length === 0}
            onChange={(event) => onSelectedSavedMatch(event.target.value)}
          >
            {savedMatches.length === 0 ? (
              <option value="">No saved matches yet</option>
            ) : (
              <>
                <option value="">Choose a match</option>
                {savedMatches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </label>
        <div className="saved-match-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={!selectedSavedMatchId || calculating}
            onClick={onLoadSavedMatch}
          >
            Load
          </button>
          <button
            className="text-button danger-button"
            type="button"
            disabled={!selectedSavedMatchId || calculating}
            onClick={onDeleteSavedMatch}
          >
            Delete
          </button>
        </div>
        {storageMessage && (
          <p
            className={storageMessageIsError ? "storage-message error" : "storage-message"}
            role={storageMessageIsError ? "alert" : "status"}
          >
            {storageMessage}
          </p>
        )}
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
                    <ClassPicker
                      value={deck.classId}
                      label={`Opponent deck ${index + 1} class`}
                      onChange={(classId) => setOpponentClass(index, classId)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {input.myDecks.map((deck, row) => (
                <tr key={`mine-${row}`}>
                  <th scope="row">
                    <ClassPicker
                      value={deck.classId}
                      label={`Your deck ${row + 1} class`}
                      onChange={(classId) => setMyClass(row, classId)}
                    />
                  </th>
                  {input.opponentDecks.map((opponentDeck, column) => (
                    <td key={`${row}-${column}`}>
                      <label className="percent-input">
                        <span className="sr-only">
                          {className(deck.classId)} win rate against {className(opponentDeck.classId)}
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
        <label className="threshold-field">
          <span>Hide picks below</span>
          <span className="percent-input compact">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={input.displayThreshold}
              onChange={(event) =>
                onChange({ ...input, displayThreshold: Number(event.target.value) })
              }
            />
            <span>%</span>
          </span>
        </label>
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
    </section>
  );
}

