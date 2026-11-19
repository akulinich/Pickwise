import { useEffect } from "react";

interface ImporterGuideProps {
  onClose(): void;
}

export function ImporterGuide({ onClose }: ImporterGuideProps) {
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

  return (
    <div className="guide-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="importer-guide-title">
        <div className="guide-header">
          <div>
            <p className="eyebrow">Chrome extension</p>
            <h2 id="importer-guide-title">Import current matchup data</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close importer guide" onClick={onClose}>×</button>
        </div>

        <div className="guide-content">
          <div className="guide-download">
            <div>
              <strong>Pickwise Matchup Exporter</strong>
              <span>Reads the table only when you click it and saves a CSV to your computer.</span>
            </div>
            <a className="primary-button guide-download-button" href={`${import.meta.env.BASE_URL}downloads/pickwise-matchup-exporter.zip`} download>
              Download ZIP
            </a>
          </div>

          <div className="guide-columns">
            <section>
              <p className="eyebrow">Install once</p>
              <ol>
                <li>Unzip the downloaded file.</li>
                <li>Open <code>chrome://extensions</code> in desktop Chrome.</li>
                <li>Turn on <strong>Developer mode</strong>.</li>
                <li>Click <strong>Load unpacked</strong> and select the unzipped folder.</li>
                <li>Pin <strong>Pickwise Matchup Exporter</strong> from the Extensions menu.</li>
              </ol>
            </section>
            <section>
              <p className="eyebrow">Export and use</p>
              <ol>
                <li>Click the extension and choose <strong>Open HSGuru</strong> or <strong>Open HSReplay</strong>.</li>
                <li>Wait for the prefiltered <strong>Legend / Last 3 days</strong> table to load.</li>
                <li>Click the extension again, then <strong>Export current tab to CSV</strong>.</li>
                <li>Return to Pickwise and click <strong>Import CSV</strong>.</li>
                <li>Choose <strong>Imported</strong> as the source and select four decks per lineup.</li>
              </ol>
            </section>
          </div>

          <p className="guide-note">
            Installation requires desktop Chrome. Updates are manual: download the new ZIP, replace the files, then click Reload on the extension card.
          </p>
        </div>
      </section>
    </div>
  );
}
