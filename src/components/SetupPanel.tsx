import { ClassPicker } from "./ClassPicker";
import { classIconUrl, type DeckInput, type SolverInput } from "../domain/model";
import { formatProbabilityInput } from "../utils/format";

interface SetupPanelProps {
  input: SolverInput;
  errors: string[];
  calculating: boolean;
  onChange(next: SolverInput): void;
  onCalculate(): void;
}

function updateDeck(decks: DeckInput[], index: number, patch: Partial<DeckInput>): DeckInput[] {
  return decks.map((deck, deckIndex) => (deckIndex === index ? { ...deck, ...patch } : deck));
}

export function SetupPanel({
  input,
  errors,
  calculating,
  onChange,
  onCalculate,
}: SetupPanelProps) {
  const setMatrixValue = (row: number, column: number, raw: string) => {
    const next = input.matrix.map((values) => [...values]);
    next[row][column] = raw === "" ? Number.NaN : Number(raw);
    onChange({ ...input, matrix: next });
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

      <div className="lineup-grid">
        <LineupEditor
          title="Your lineup"
          decks={input.myDecks}
          onChange={(myDecks) => onChange({ ...input, myDecks })}
        />
        <LineupEditor
          title="Opponent lineup"
          decks={input.opponentDecks}
          onChange={(opponentDecks) => onChange({ ...input, opponentDecks })}
        />
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
                <th aria-label="Your deck" />
                {input.opponentDecks.map((deck, index) => (
                  <th key={`opponent-${index}`} scope="col">
                    <img className="matrix-class-icon" src={classIconUrl(deck.classId)} alt="" />
                    <small>{deck.name || "Unnamed"}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {input.myDecks.map((deck, row) => (
                <tr key={`mine-${row}`}>
                  <th scope="row">
                    <img className="matrix-class-icon" src={classIconUrl(deck.classId)} alt="" />
                    <small>{deck.name || "Unnamed"}</small>
                  </th>
                  {input.opponentDecks.map((opponentDeck, column) => (
                    <td key={`${row}-${column}`}>
                      <label className="percent-input">
                        <span className="sr-only">
                          {deck.name} win rate against {opponentDeck.name}
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

interface LineupEditorProps {
  title: string;
  decks: DeckInput[];
  onChange(decks: DeckInput[]): void;
}

function LineupEditor({ title, decks, onChange }: LineupEditorProps) {
  return (
    <div className="lineup-card">
      <div className="lineup-card-heading">
        <h3>{title}</h3>
      </div>
      <div className="deck-list">
        {decks.map((deck, index) => (
          <div className="deck-row" key={index}>
            <ClassPicker
              value={deck.classId}
              label={`${title} deck ${index + 1} class`}
              onChange={(classId) => onChange(updateDeck(decks, index, { classId }))}
            />
            <label className="deck-name-field">
              <span className="sr-only">{title} deck {index + 1} name</span>
              <input
                value={deck.name}
                maxLength={48}
                placeholder="Deck name"
                onChange={(event) =>
                  onChange(updateDeck(decks, index, { name: event.target.value }))
                }
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
