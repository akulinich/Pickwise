import { useCallback, useMemo, useState } from "react";
import { SetupPanel } from "./components/SetupPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { MathExplorer } from "./components/MathExplorer";
import {
  cloneInput,
  createDefaultInput,
  probabilityMatrix,
  validateInput,
  type SolverInput,
} from "./domain/model";
import {
  recommendedBan,
  solveBans,
  type BanResult,
} from "./solver/conquest";

export default function App() {
  const [input, setInput] = useState<SolverInput>(() => createDefaultInput());
  const [solvedInput, setSolvedInput] = useState<SolverInput | null>(null);
  const [result, setResult] = useState<BanResult | null>(null);
  const [stale, setStale] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState("");
  const [selectedViewOurBan, setSelectedViewOurBan] = useState(0);
  const [selectedPdfOurBan, setSelectedPdfOurBan] = useState(0);
  const [selectedOpponentBan, setSelectedOpponentBan] = useState(0);
  const [showMath, setShowMath] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const validationErrors = useMemo(() => validateInput(input), [input]);

  const handleInputChange = useCallback(
    (next: SolverInput) => {
      setInput(next);
      if (result) setStale(true);
    },
    [result],
  );

  const handleCalculate = () => {
    if (validationErrors.length > 0) {
      setCalculationError(validationErrors.join(" "));
      return;
    }
    setCalculating(true);
    setCalculationError("");
    setPdfError("");
    window.setTimeout(() => {
      try {
        const snapshot = cloneInput(input);
        const nextResult = solveBans(probabilityMatrix(snapshot));
        const ourBan = recommendedBan(nextResult.myBanStrategy);
        const opponentBan = recommendedBan(nextResult.opponentBanStrategy);
        setSolvedInput(snapshot);
        setResult(nextResult);
        setSelectedViewOurBan(ourBan);
        setSelectedPdfOurBan(ourBan);
        setSelectedOpponentBan(opponentBan);
        setStale(false);
        window.setTimeout(() => {
          document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      } catch (error) {
        setCalculationError(error instanceof Error ? error.message : "The solver could not finish.");
      } finally {
        setCalculating(false);
      }
    }, 0);
  };

  const handleDownloadPdf = async () => {
    if (!result || !solvedInput || stale) return;
    setPdfBusy(true);
    setPdfError("");
    try {
      const { downloadPdf, generateConquestPdf } = await import("./pdf/generatePdf");
      const bytes = await generateConquestPdf(solvedInput, result, selectedPdfOurBan);
      downloadPdf(bytes, solvedInput.eventName);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "PDF generation failed.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Pickwise home">
          <span className="brand-mark">PW</span>
          <span>
            <strong>Pickwise</strong>
            <small>Conquest solver</small>
          </span>
        </a>
        <a className="github-link" href="https://github.com/akulinich/Pickwise" target="_blank" rel="noreferrer">
          View source
        </a>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Hearthstone · Conquest 4 × 4</p>
            <h1>Turn matchup data into a match plan.</h1>
            <p>
              Exact zero-sum strategy for simultaneous bans and every post-ban deck decision.
              Calculated locally in your browser.
            </p>
          </div>
          <div className="hero-metric" aria-label="Solver characteristics">
            <div><strong>16</strong><span>ban pairs</span></div>
            <div><strong>63</strong><span>states per game</span></div>
            <div><strong>0</strong><span>data uploads</span></div>
          </div>
        </section>

        <SetupPanel
          input={input}
          errors={calculationError ? [calculationError] : validationErrors}
          calculating={calculating}
          onChange={handleInputChange}
          onCalculate={handleCalculate}
        />

        {result && solvedInput && (
          <div id="results">
            <ResultsPanel
              input={solvedInput}
              result={result}
              stale={stale}
              selectedViewOurBan={selectedViewOurBan}
              selectedPdfOurBan={selectedPdfOurBan}
              selectedOpponentBan={selectedOpponentBan}
              pdfBusy={pdfBusy}
              pdfError={pdfError}
              onSelectedViewOurBan={setSelectedViewOurBan}
              onSelectedPdfOurBan={setSelectedPdfOurBan}
              onSelectedOpponentBan={setSelectedOpponentBan}
              onShowMath={() => setShowMath(true)}
              onDownloadPdf={handleDownloadPdf}
            />
          </div>
        )}
      </main>

      <footer>
        <span>Pickwise runs entirely in your browser.</span>
        <span>
          Hearthstone class icons from HearthSim HSTracker · Hearthstone © Blizzard Entertainment
        </span>
      </footer>

      {showMath && result && solvedInput && (
        <MathExplorer
          input={solvedInput}
          result={result}
          initialOurBan={selectedViewOurBan}
          initialOpponentBan={selectedOpponentBan}
          onClose={() => setShowMath(false)}
        />
      )}
    </div>
  );
}
