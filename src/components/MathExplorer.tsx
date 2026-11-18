import { useEffect, useMemo, useState } from "react";
import { className, type SolverInput } from "../domain/model";
import {
  maskToIndices,
  popcount,
  type BanResult,
  type StateResult,
} from "../solver/conquest";
import { formatPercent, stateLabel, strategyLabel } from "../utils/format";

interface MathExplorerProps {
  input: SolverInput;
  result: BanResult;
  initialOurBan: number;
  initialOpponentBan: number;
  onClose(): void;
}

function FormulaCell({
  state,
  row,
  column,
  input,
  getState,
}: {
  state: StateResult;
  row: number;
  column: number;
  input: SolverInput;
  getState(myMask: number, opponentMask: number): StateResult;
}) {
  const myDeck = state.myDecks[row];
  const opponentDeck = state.opponentDecks[column];
  const probability = input.matrix[myDeck][opponentDeck] / 100;
  const winMask = state.myMask & ~(1 << myDeck);
  const lossMask = state.opponentMask & ~(1 << opponentDeck);
  const winChild = getState(winMask, state.opponentMask);
  const lossChild = getState(state.myMask, lossMask);
  const value = state.qMatrix[row][column];
  return (
    <div className="formula-cell">
      <strong>Q[{className(input.myDecks[myDeck].classId)}, {className(input.opponentDecks[opponentDeck].classId)}]</strong>
      <code>
        {formatPercent(probability, 1)} × V({stateLabel(winMask, input.myDecks)},{" "}
        {stateLabel(state.opponentMask, input.opponentDecks)}) +{" "}
        {formatPercent(1 - probability, 1)} × V({stateLabel(state.myMask, input.myDecks)},{" "}
        {stateLabel(lossMask, input.opponentDecks)})
      </code>
      <span>
        = {probability.toFixed(6)} × {winChild.value.toFixed(9)} +{" "}
        {(1 - probability).toFixed(6)} × {lossChild.value.toFixed(9)}
      </span>
      <b>= {value.toFixed(12)}</b>
    </div>
  );
}

export function MathExplorer({
  input,
  result,
  initialOurBan,
  initialOpponentBan,
  onClose,
}: MathExplorerProps) {
  const [ourBan, setOurBan] = useState(initialOurBan);
  const [opponentBan, setOpponentBan] = useState(initialOpponentBan);
  const solution = result.getPostBanSolution(ourBan, opponentBan);
  const states = useMemo(
    () =>
      [...solution.states.values()].sort((left, right) => {
        const depthDifference =
          popcount(left.myMask) +
          popcount(left.opponentMask) -
          (popcount(right.myMask) + popcount(right.opponentMask));
        if (depthDifference !== 0) return depthDifference;
        if (left.myMask !== right.myMask) return left.myMask - right.myMask;
        return left.opponentMask - right.opponentMask;
      }),
    [solution],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  return (
    <div className="math-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="math-dialog" role="dialog" aria-modal="true" aria-labelledby="math-title">
        <header className="math-header">
          <div>
            <p className="eyebrow">Complete calculation trace</p>
            <h2 id="math-title">How Pickwise got this answer</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close math explorer" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="math-content">
          <nav className="math-index" aria-label="Math sections">
            <a href="#notation">Notation</a>
            <a href="#ban-game">Ban game</a>
            <a href="#post-ban">Post-ban game</a>
            <a href="#states">All states</a>
          </nav>

          <article id="notation" className="math-section">
            <p className="eyebrow">01 · Notation</p>
            <h3>One value for every actual set of decks</h3>
            <div className="math-scope" aria-label="Calculation scope">
              <div><strong>16</strong><span>ban pairs</span></div>
              <div><strong>63</strong><span>reachable states per post-ban game</span></div>
              <div><strong>0</strong><span>data uploads</span></div>
            </div>
            <div className="notation-grid">
              <div><strong>P[i,j]</strong><span>single-game win probability</span></div>
              <div><strong>S / T</strong><span>decks still needing a win</span></div>
              <div><strong>V(S,T)</strong><span>chance to win the match from this state</span></div>
              <div><strong>Q(S,T)</strong><span>continuation payoff for each next pairing</span></div>
            </div>
            <div className="base-cases">
              <code>V(∅, T) = 1</code><span>Your decks are complete: you won.</span>
              <code>V(S, ∅) = 0</code><span>The opponent's decks are complete: you lost.</span>
            </div>
          </article>

          <article id="ban-game" className="math-section">
            <p className="eyebrow">02 · Ban game</p>
            <h3>Sixteen complete Conquest games become one 4 × 4 game</h3>
            <div className="math-ban-grid">
              {result.payoffMatrix.map((row, rowIndex) =>
                row.map((value, columnIndex) => (
                  <div key={`${rowIndex}-${columnIndex}`}>
                    <span>
                      Ban {className(input.opponentDecks[rowIndex].classId)} / lose {className(input.myDecks[columnIndex].classId)}
                    </span>
                    <strong>{formatPercent(value, 3)}</strong>
                  </div>
                )),
              )}
            </div>
            <div className="lp-summary">
              <div><span>Row (your ban) strategy</span><strong>{strategyLabel(result.myBanStrategy, input.opponentDecks)}</strong></div>
              <div><span>Column (their ban) strategy</span><strong>{strategyLabel(result.opponentBanStrategy, input.myDecks)}</strong></div>
              <div><span>Primal value</span><code>{result.game.primalValue.toFixed(12)}</code></div>
              <div><span>Dual value</span><code>{result.game.dualValue.toFixed(12)}</code></div>
              <div><span>Primal / dual gap</span><code>{result.game.gap.toExponential(3)}</code></div>
              <div><span>Final value</span><strong>{formatPercent(result.value, 6)}</strong></div>
            </div>
          </article>

          <article id="post-ban" className="math-section">
            <p className="eyebrow">03 · Choose one of all 16 post-ban games</p>
            <div className="math-pair-selectors">
              <label>
                <span>You ban</span>
                <select value={ourBan} onChange={(event) => setOurBan(Number(event.target.value))}>
                  {input.opponentDecks.map((deck, index) => (
                    <option value={index} key={index}>{className(deck.classId)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>They ban</span>
                <select value={opponentBan} onChange={(event) => setOpponentBan(Number(event.target.value))}>
                  {input.myDecks.map((deck, index) => (
                    <option value={index} key={index}>{className(deck.classId)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="post-ban-root">
              <span>Root state value</span>
              <strong>{formatPercent(solution.value, 6)}</strong>
              <code>{solution.value.toFixed(15)}</code>
            </div>
          </article>

          <article id="states" className="math-section states-section">
            <p className="eyebrow">04 · All {states.length} reachable states</p>
            <h3>From base cases to the 3 × 3 root</h3>
            <p className="math-intro">
              Open any state to see its complete Q matrix, numeric substitutions, both optimal
              strategies and LP agreement. States are ordered by |S| + |T|.
            </p>
            <div className="state-trace-list">
              {states.map((state) => {
                const terminal = state.myMask === 0 || state.opponentMask === 0;
                return (
                  <details key={`${state.myMask}:${state.opponentMask}`} className="state-trace">
                    <summary>
                      <code>
                        V({stateLabel(state.myMask, input.myDecks)},{" "}
                        {stateLabel(state.opponentMask, input.opponentDecks)})
                      </code>
                      <strong>{formatPercent(state.value, 6)}</strong>
                      <span>{terminal ? "base case" : `${state.myDecks.length} × ${state.opponentDecks.length}`}</span>
                    </summary>
                    <div className="state-trace-body">
                      {terminal ? (
                        <p>
                          {state.myMask === 0
                            ? "Your remaining set is empty, so all your decks have won: V = 1."
                            : "The opponent's remaining set is empty, so all their decks have won: V = 0."}
                        </p>
                      ) : (
                        <>
                          <div className="formula-grid">
                            {state.myDecks.flatMap((_, row) =>
                              state.opponentDecks.map((__, column) => (
                                <FormulaCell
                                  key={`${row}-${column}`}
                                  state={state}
                                  row={row}
                                  column={column}
                                  input={input}
                                  getState={(myMask, opponentMask) => solution.getState(myMask, opponentMask)}
                                />
                              )),
                            )}
                          </div>
                          <div className="lp-summary compact-summary">
                            <div><span>Your strategy</span><strong>{strategyLabel(state.myStrategy, input.myDecks)}</strong></div>
                            <div><span>Opponent strategy</span><strong>{strategyLabel(state.opponentStrategy, input.opponentDecks)}</strong></div>
                            <div><span>Primal</span><code>{state.primalValue?.toFixed(12)}</code></div>
                            <div><span>Dual</span><code>{state.dualValue?.toFixed(12)}</code></div>
                            <div><span>Gap</span><code>{state.gap?.toExponential(3)}</code></div>
                            <div><span>V(S,T)</span><strong>{state.value.toFixed(12)}</strong></div>
                          </div>
                        </>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
