import type { SolverInput } from "../domain/model";
import type { ConquestSolution } from "../solver/conquest";
import { formatPercent, heatColor } from "../utils/format";
import { subsetsForMask } from "../solver/conquest";
import { DeckSet, StrategyMix } from "./DeckIcons";

interface DecisionTableProps {
  solution: ConquestSolution;
  input: SolverInput;
  compact?: boolean;
}

export function DecisionTable({ solution, input, compact = true }: DecisionTableProps) {
  const minimumSize = compact ? 2 : 1;
  const myStates = subsetsForMask(solution.myMask, minimumSize);
  const opponentStates = subsetsForMask(solution.opponentMask, minimumSize);
  const threshold = input.displayThreshold / 100;

  return (
    <div className="decision-table-scroll">
      <table className="decision-table">
        <thead>
          <tr>
            <th scope="col" className="corner-cell">
              Mine ↓ / Theirs →
            </th>
            {opponentStates.map((mask) => (
              <th scope="col" key={mask}>
                <DeckSet mask={mask} decks={input.opponentDecks} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {myStates.map((myMask) => (
            <tr key={myMask}>
              <th scope="row"><DeckSet mask={myMask} decks={input.myDecks} /></th>
              {opponentStates.map((opponentMask) => {
                const state = solution.getState(myMask, opponentMask);
                return (
                  <td key={`${myMask}:${opponentMask}`} style={{ background: heatColor(state.value) }}>
                    <strong>{formatPercent(state.value, 1)}</strong>
                    <StrategyMix strategy={state.myStrategy} decks={input.myDecks} threshold={threshold} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
