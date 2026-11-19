import { useMemo, useRef, useState } from "react";
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
import {
  clearActiveMatchId,
  deleteMatch,
  getActiveMatchId,
  listSavedMatches,
  loadMatch,
  saveMatch,
  setActiveMatchId,
} from "./storage/savedMatches";
import {
  importedDeckInput,
  importedMatrix,
  listImportedSnapshots,
  parseImportedCsv,
  saveImportedSnapshot,
  type ImportedSnapshot,
} from "./storage/importedMatchups";

function createInitialSession(): { input: SolverInput; activeSavedMatchId: string } {
  const activeSavedMatchId = getActiveMatchId();
  const saved = activeSavedMatchId ? loadMatch(activeSavedMatchId) : null;
  if (!saved) return { input: createDefaultInput(), activeSavedMatchId: "" };
  return { input: cloneInput(saved.input), activeSavedMatchId: saved.id };
}

export default function App() {
  const [initialSession] = useState(createInitialSession);
  const [input, setInput] = useState<SolverInput>(() => initialSession.input);
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
  const [savedMatches, setSavedMatches] = useState(() => listSavedMatches());
  const [activeSavedMatchId, setActiveSavedMatchIdState] = useState(
    initialSession.activeSavedMatchId,
  );
  const activeSavedMatchIdRef = useRef(initialSession.activeSavedMatchId);
  const [storageMessage, setStorageMessage] = useState("");
  const [storageMessageIsError, setStorageMessageIsError] = useState(false);
  const [importedSnapshots, setImportedSnapshots] = useState<ImportedSnapshot[]>(() => listImportedSnapshots());
  const [importMessage, setImportMessage] = useState("");
  const [importMessageIsError, setImportMessageIsError] = useState(false);
  const validationErrors = useMemo(() => validateInput(input), [input]);
  const importedSnapshot = useMemo(
    () => importedSnapshots.find((snapshot) => snapshot.id === input.importedSnapshotId) ?? null,
    [importedSnapshots, input.importedSnapshotId],
  );

  const showSolution = (snapshot: SolverInput, nextResult: BanResult) => {
    const ourBan = recommendedBan(nextResult.myBanStrategy);
    const opponentBan = recommendedBan(nextResult.opponentBanStrategy);
    setInput(cloneInput(snapshot));
    setSolvedInput(snapshot);
    setResult(nextResult);
    setSelectedViewOurBan(ourBan);
    setSelectedPdfOurBan(ourBan);
    setSelectedOpponentBan(opponentBan);
    setStale(false);
    setShowMath(false);
  };

  const scrollToResults = () => {
    window.setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const rememberActiveMatch = (id: string) => {
    activeSavedMatchIdRef.current = id;
    setActiveSavedMatchIdState(id);
    setActiveMatchId(id);
  };

  const forgetActiveMatch = () => {
    activeSavedMatchIdRef.current = "";
    setActiveSavedMatchIdState("");
    clearActiveMatchId();
  };

  const handleInputChange = (next: SolverInput) => {
    setInput(next);
    if (result) setStale(true);
    if (validateInput(next).length > 0) {
      setStorageMessage("");
      return;
    }
    try {
      const previousId = activeSavedMatchIdRef.current;
      const saved = saveMatch(next);
      if (previousId && previousId !== saved.id) deleteMatch(previousId);
      rememberActiveMatch(saved.id);
      setSavedMatches(listSavedMatches());
      setStorageMessage("Saved locally.");
      setStorageMessageIsError(false);
    } catch (error) {
      setStorageMessage(
        error instanceof Error ? error.message : "The match could not be saved locally.",
      );
      setStorageMessageIsError(true);
    }
  };

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
        const snapshot = cloneInput({ ...input, eventName: input.eventName.trim() });
        const nextResult = solveBans(probabilityMatrix(snapshot));
        showSolution(snapshot, nextResult);
        try {
          const saved = saveMatch(snapshot);
          const previousId = activeSavedMatchIdRef.current;
          if (previousId && previousId !== saved.id) {
            deleteMatch(previousId);
          }
          setSavedMatches(listSavedMatches());
          rememberActiveMatch(saved.id);
          setStorageMessage(`Saved locally as “${saved.name}”.`);
          setStorageMessageIsError(false);
        } catch (error) {
          setStorageMessage(
            error instanceof Error ? error.message : "The calculation could not be saved locally.",
          );
          setStorageMessageIsError(true);
        }
        scrollToResults();
      } catch (error) {
        setCalculationError(error instanceof Error ? error.message : "The solver could not finish.");
      } finally {
        setCalculating(false);
      }
    }, 0);
  };

  const handleLoadSavedMatch = (id: string) => {
    const saved = loadMatch(id);
    if (!saved) {
      setSavedMatches(listSavedMatches());
      if (activeSavedMatchIdRef.current === id) forgetActiveMatch();
      setStorageMessage("That saved match is no longer available.");
      setStorageMessageIsError(true);
      return;
    }
    setCalculating(true);
    setCalculationError("");
    setPdfError("");
    window.setTimeout(() => {
      try {
        const snapshot = cloneInput(saved.input);
        showSolution(snapshot, solveBans(probabilityMatrix(snapshot)));
        rememberActiveMatch(saved.id);
        setStorageMessage(`Loaded “${saved.name}”.`);
        setStorageMessageIsError(false);
        scrollToResults();
      } catch (error) {
        setCalculationError(error instanceof Error ? error.message : "The saved match could not be loaded.");
      } finally {
        setCalculating(false);
      }
    }, 0);
  };

  const handleDeleteSavedMatch = (id: string) => {
    const saved = savedMatches.find((match) => match.id === id);
    if (!saved || !window.confirm(`Delete the saved calculation “${saved.name}”?`)) return;
    try {
      deleteMatch(saved.id);
      setSavedMatches(listSavedMatches());
      if (activeSavedMatchIdRef.current === saved.id) forgetActiveMatch();
      setStorageMessage(`Deleted “${saved.name}”.`);
      setStorageMessageIsError(false);
    } catch (error) {
      setStorageMessage(
        error instanceof Error ? error.message : "The saved match could not be deleted.",
      );
      setStorageMessageIsError(true);
    }
  };

  const handleNewMatch = () => {
    const usedNames = new Set(savedMatches.map((match) => match.name.toLocaleLowerCase("en-US")));
    let name = "New match";
    let suffix = 2;
    while (usedNames.has(name.toLocaleLowerCase("en-US"))) {
      name = `New match ${suffix}`;
      suffix += 1;
    }
    setInput({ ...createDefaultInput(), eventName: name });
    setSolvedInput(null);
    setResult(null);
    setStale(false);
    setShowMath(false);
    setCalculationError("");
    setPdfError("");
    setStorageMessage("");
    setStorageMessageIsError(false);
    forgetActiveMatch();
  };

  const withImportedDecks = (snapshot: ImportedSnapshot, current: SolverInput): SolverInput => {
    const choose = (decks: SolverInput["myDecks"]) =>
      decks.map((deck, index) => {
        const imported = snapshot.decks.find((candidate) => candidate.id === deck.importedId)
          ?? snapshot.decks[index % snapshot.decks.length];
        return importedDeckInput(imported);
      });
    const myDecks = choose(current.myDecks);
    const opponentDecks = choose(current.opponentDecks);
    const { matrix, missing } = importedMatrix(snapshot, myDecks, opponentDecks);
    setImportMessage(
      missing > 0
        ? `Imported data has ${missing} missing matchup ${missing === 1 ? "cell" : "cells"}; 50% was used for them.`
        : `Using ${snapshot.source} data captured ${new Date(snapshot.capturedAt).toLocaleString()}.`,
    );
    setImportMessageIsError(false);
    return {
      ...current,
      dataSource: "imported",
      importedSnapshotId: snapshot.id,
      myDecks,
      opponentDecks,
      matrix,
    };
  };

  const handleImportCsv = async (file: File) => {
    setImportMessage("Reading CSV…");
    setImportMessageIsError(false);
    try {
      const snapshot = parseImportedCsv(await file.text());
      saveImportedSnapshot(snapshot);
      setImportedSnapshots(listImportedSnapshots());
      handleInputChange(withImportedDecks(snapshot, input));
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "The CSV could not be imported.");
      setImportMessageIsError(true);
    }
  };

  const handleSourceChange = (source: SolverInput["dataSource"]) => {
    if (source === "imported") {
      const snapshot = importedSnapshot ?? importedSnapshots[0];
      if (!snapshot) {
        setImportMessage("Import a CSV before choosing Imported.");
        setImportMessageIsError(true);
        return;
      }
      handleInputChange(withImportedDecks(snapshot, input));
      return;
    }
    handleInputChange({
      ...input,
      dataSource: "none",
      importedSnapshotId: undefined,
      myDecks: input.myDecks.map(({ classId }) => ({ classId })),
      opponentDecks: input.opponentDecks.map(({ classId }) => ({ classId })),
    });
    setImportMessage("");
    setImportMessageIsError(false);
  };

  const handleImportedSnapshotChange = (snapshotId: string) => {
    const snapshot = importedSnapshots.find((item) => item.id === snapshotId);
    if (!snapshot) return;
    handleInputChange(withImportedDecks(snapshot, input));
  };

  const handleImportedDeckChange = (side: "mine" | "opponent", index: number, deckId: string) => {
    if (!importedSnapshot) return;
    const selected = importedSnapshot.decks.find((deck) => deck.id === deckId);
    if (!selected) return;
    const myDecks = input.myDecks.map((deck, deckIndex) =>
      side === "mine" && deckIndex === index ? importedDeckInput(selected) : deck,
    );
    const opponentDecks = input.opponentDecks.map((deck, deckIndex) =>
      side === "opponent" && deckIndex === index ? importedDeckInput(selected) : deck,
    );
    const { matrix, missing } = importedMatrix(importedSnapshot, myDecks, opponentDecks);
    handleInputChange({ ...input, myDecks, opponentDecks, matrix });
    setImportMessage(
      missing > 0
        ? `${missing} missing matchup ${missing === 1 ? "cell uses" : "cells use"} 50%.`
        : "All 16 matchup cells were filled from the imported data.",
    );
    setImportMessageIsError(false);
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
        </section>

        <SetupPanel
          input={input}
          errors={calculationError ? [calculationError] : validationErrors}
          calculating={calculating}
          savedMatches={savedMatches}
          activeSavedMatchId={activeSavedMatchId}
          storageMessage={storageMessage}
          storageMessageIsError={storageMessageIsError}
          importedSnapshots={importedSnapshots}
          importedSnapshot={importedSnapshot}
          importMessage={importMessage}
          importMessageIsError={importMessageIsError}
          onChange={handleInputChange}
          onCalculate={handleCalculate}
          onLoadSavedMatch={handleLoadSavedMatch}
          onDeleteSavedMatch={handleDeleteSavedMatch}
          onNewMatch={handleNewMatch}
          onImportCsv={handleImportCsv}
          onSourceChange={handleSourceChange}
          onImportedSnapshotChange={handleImportedSnapshotChange}
          onImportedDeckChange={handleImportedDeckChange}
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
        <span>Not affiliated with Blizzard Entertainment.</span>
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
