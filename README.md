# Pickwise

Pickwise is a static, client-side Conquest match planner for Hearthstone. It
uses the same exact dynamic-programming and zero-sum LP model as the HSAI
Conquest solver, presents a compact match plan, exposes every calculation in a
**Show math** view, and exports a one-page A4 landscape match sheet. Matchup
statistics can be exported from the currently open HSGuru or HSReplay tab with
the bundled Chrome extension and imported as CSV.

## Local development

Requires Node.js 24 or newer.

```bash
npm ci
npm run dev
```

The Vite development server prints the local URL. All calculations and PDF
generation happen in the browser; the application has no backend. Saved matches
and imported matchup datasets stay in the browser's local storage.

## Matchup importer

The unpacked Manifest V3 extension source is in `extension/`. The downloadable
archive kept for private installation is
`extension/pickwise-matchup-exporter.zip`. It reads only the active tab after
an explicit click and downloads a local CSV; it does not send data to a server.
The public application does not link to or document the extension.

Each CSV capture is stored separately, so a match can select a particular
HSGuru or HSReplay dataset while other imported variants remain available.

## Verification

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Deployment

The production base path is `/Pickwise/`. Pushes to `main` run unit tests, the
production build, and Playwright E2E tests before deploying `dist/` to GitHub
Pages. Pull requests run the same checks without deploying. The workflow can
also be started manually.

In the repository settings, select **GitHub Actions** as the Pages source. The
expected URL is:

`https://akulinich.github.io/Pickwise/`

See [PLAN.md](PLAN.md) for the agreed product scope and implementation design.
