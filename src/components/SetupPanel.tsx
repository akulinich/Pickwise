import { ClassPicker } from "./ClassPicker";
import { MatchPicker } from "./MatchPicker";
import { className, type SolverInput } from "../domain/model";
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
  onChange(next: SolverInput): void;
  onCalculate(): void;
  onLoadSavedMatch(id: string): void;
  onDeleteSavedMatch(id: string): void;
  onNewMatch(): void;
}

export function SetupPanel({
  input,
  errors,
  calculating,
  savedMatches,
  activeSavedMatchId,
  storageMessage,
  storageMessageIsError,
  onChange,
  onCalculate,
  onLoadSavedMatch,
  onDeleteSavedMatch,
  onNewMatch,
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
                    <td
                      key={`${row}-${column}`}
                      style={{ background: matchupInputColor(input.matrix[row][column]) }}
                    >
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

