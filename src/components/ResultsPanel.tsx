import { classIconUrl, className, type SolverInput } from "../domain/model";
import {
  recommendedBan,
  type BanResult,
  type WeightedDeck,
} from "../solver/conquest";
import { formatPercent, heatColor } from "../utils/format";
import { DecisionTable } from "./DecisionTable";
import { DeckIcon } from "./DeckIcons";

interface ResultsPanelProps {
  input: SolverInput;
  result: BanResult;
  stale: boolean;
  selectedViewOurBan: number;
  selectedPdfOurBan: number;
  selectedOpponentBan: number;
  pdfBusy: boolean;
  pdfError: string;
  onSelectedViewOurBan(value: number): void;
  onSelectedPdfOurBan(value: number): void;
  onSelectedOpponentBan(value: number): void;
  onShowMath(): void;
  onDownloadPdf(): void;
}

function StrategyList({
  title,
  strategy,
  decks,
}: {
  title: string;
  strategy: WeightedDeck[];
  decks: SolverInput["myDecks"];
}) {
  return (
    <div className="strategy-card">
      <p>{title}</p>
      <div className="strategy-bars">
        {strategy.map((item) => (
          <div className="strategy-row" key={item.deck}>
            <img src={classIconUrl(decks[item.deck].classId)} alt="" />
            <span className="strategy-name">{className(decks[item.deck].classId)}</span>
            <span>{formatPercent(item.probability, 1)}</span>
            <i style={{ width: `${Math.max(1, item.probability * 100)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultsPanel({
  input,
  result,
  stale,
  selectedViewOurBan,
  selectedPdfOurBan,
  selectedOpponentBan,
  pdfBusy,
  pdfError,
  onSelectedViewOurBan,
  onSelectedPdfOurBan,
  onSelectedOpponentBan,
  onShowMath,
  onDownloadPdf,
}: ResultsPanelProps) {
  const solution = result.getPostBanSolution(selectedViewOurBan, selectedOpponentBan);
  const defaultBan = recommendedBan(result.myBanStrategy);

  return (
    <section className="results-shell" aria-labelledby="results-heading">
      <div className="results-header">
        <div>
          <p className="eyebrow">Solved at optimal play</p>
          <h2 id="results-heading">Conquest strategy</h2>
        </div>
        <div className="result-value">
          <span>Pre-ban match win chance</span>
          <strong>{formatPercent(result.value, 1)}</strong>
        </div>
      </div>

      {stale && (
        <div className="stale-banner" role="status">
          Inputs changed. These results are preserved for reference; calculate again before exporting.
        </div>
      )}

      <div className="strategy-grid">
        <StrategyList title="Your optimal bans" strategy={result.myBanStrategy} decks={input.opponentDecks} />
        <StrategyList
          title="Opponent's optimal bans"
          strategy={result.opponentBanStrategy}
          decks={input.myDecks}
        />
      </div>

      <div className="payoff-card">
        <div className="matrix-title-row">
          <div>
            <p className="eyebrow">Ban payoff matrix</p>
            <h3>Chance to win the complete match</h3>
          </div>
          <button className="secondary-button" type="button" onClick={onShowMath}>
            Show math
          </button>
        </div>
        <div className="matrix-scroll">
          <table className="payoff-matrix">
            <thead>
              <tr>
                <th scope="col">You ban ↓ / They ban →</th>
                {input.myDecks.map((deck, index) => (
                  <th scope="col" key={index}><DeckIcon deck={deck} className="table-deck-icon" /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.payoffMatrix.map((row, ourBan) => (
                <tr key={ourBan}>
                  <th scope="row"><DeckIcon deck={input.opponentDecks[ourBan]} className="table-deck-icon" /></th>
                  {row.map((value, opponentBan) => (
                    <td key={opponentBan} style={{ background: heatColor(value) }}>
                      {formatPercent(value, 1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="decision-card">
        <div className="decision-heading">
          <div>
            <p className="eyebrow">Post-ban decisions</p>
            <h3>Compact strategy table</h3>
          </div>
          <div className="ban-pair-selectors">
            <label>
              <span>You ban</span>
              <select
                value={selectedViewOurBan}
                onChange={(event) => onSelectedViewOurBan(Number(event.target.value))}
              >
                {input.opponentDecks.map((deck, index) => (
                  <option key={index} value={index}>{className(deck.classId)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>They ban</span>
              <select
                value={selectedOpponentBan}
                onChange={(event) => onSelectedOpponentBan(Number(event.target.value))}
              >
                {input.myDecks.map((deck, index) => (
                  <option key={index} value={index}>{className(deck.classId)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <DecisionTable solution={solution} input={input} />
      </div>

      <div className="pdf-bar">
        <div className="pdf-copy">
          <p className="eyebrow">A4 landscape match sheet</p>
          <strong>Choose your ban for this PDF</strong>
          <span>
            The solver recommends {className(input.opponentDecks[defaultBan].classId)}. You can override it.
          </span>
        </div>
        <label className="pdf-ban-select">
          <span>Your ban</span>
          <select
            value={selectedPdfOurBan}
            onChange={(event) => onSelectedPdfOurBan(Number(event.target.value))}
          >
            {result.myBanStrategy.map((item) => (
              <option key={item.deck} value={item.deck}>
                {className(input.opponentDecks[item.deck].classId)} · {formatPercent(item.probability, 1)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary-button pdf-button"
          type="button"
          disabled={pdfBusy || stale}
          onClick={onDownloadPdf}
        >
          {pdfBusy ? "Building PDF…" : "Download PDF"}
        </button>
        {pdfError && <p className="pdf-error" role="alert">{pdfError}</p>}
      </div>
    </section>
  );
}
