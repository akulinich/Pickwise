const button = document.getElementById("export");
const status = document.getElementById("status");
const openHsguruButton = document.getElementById("open-hsguru");
const openHsreplayButton = document.getElementById("open-hsreplay");

const HSGURU_MATCHUPS_URL = "https://www.hsguru.com/matchups?format=2&rank=legend&period=past_3_days";
const HSREPLAY_MATCHUPS_URL = "https://hsreplay.net/meta/#rankRange=LEGEND&timeFrame=LAST_3_DAYS";

openHsguruButton.addEventListener("click", () => {
  chrome.tabs.create({ url: HSGURU_MATCHUPS_URL });
});

openHsreplayButton.addEventListener("click", () => {
  chrome.tabs.create({ url: HSREPLAY_MATCHUPS_URL });
});

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = kind;
}

async function collectActivePage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const url = new URL(location.href);
      const rankNames = {
        LEGEND: "Legend",
        legend: "Legend",
        DIAMOND_THROUGH_LEGEND: "Diamond–Legend",
        DIAMOND_TO_LEGEND: "Diamond–Legend",
        diamond_to_legend: "Diamond–Legend",
      };
      const periodNames = {
        LAST_1_DAY: "Last 1 day",
        LAST_3_DAYS: "Last 3 days",
        LAST_7_DAYS: "Last 7 days",
        CURRENT_PATCH: "Current patch",
        past_day: "Last 1 day",
        past_3_days: "Last 3 days",
        past_week: "Last 7 days",
      };
      const pageParams = new URLSearchParams(url.search);
      const hashParams = new URLSearchParams(url.hash.slice(1));
      const rankValue = pageParams.get("rank") || hashParams.get("rankRange") || "";
      const periodValue =
        pageParams.get("period") ||
        hashParams.get("timeFrame") ||
        hashParams.get("timeRange") ||
        hashParams.get("period") ||
        "";
      let rank = rankNames[rankValue] || rankValue || "Current page rank";
      let period = periodNames[periodValue] || periodValue || "Current page period";
      const requireProfile = () => {
        const normalize = (text) => text.toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
        const ranks = new Set(["legend"]);
        const periods = new Set(["3d", "3 days", "last 3 days", "past 3 days"]);
        if (!ranks.has(normalize(rank)) || !periods.has(normalize(period))) {
          throw new Error(`Select Legend / Last 3 days first. Current filters: ${rank} / ${period}.`);
        }
        rank = "Legend";
        period = "Last 3 days";
      };

      if (
        (url.hostname === "hsguru.com" || url.hostname === "www.hsguru.com") &&
        url.pathname.startsWith("/matchups")
      ) {
        requireProfile();
        const labels = [...document.querySelectorAll("td[aria-label*=' versus '][aria-label$=' games']")]
          .map((cell) => cell.getAttribute("aria-label"))
          .filter(Boolean);
        if (!labels.length) throw new Error("The HSGuru table has not loaded yet.");
        return {
          source: "HSGuru",
          sourceUrl: url.href,
          rank,
          period,
          capturedAt: new Date().toISOString(),
          labels,
          archetypes: [],
        };
      }

      if (
        (url.hostname === "hsreplay.net" || url.hostname === "www.hsreplay.net") &&
        url.pathname.includes("/meta/")
      ) {
        const selectedFilterText = (selector) => {
          const selected = document.querySelector(selector)?.cloneNode(true);
          selected?.querySelectorAll("img, .infobox-value").forEach((item) => item.remove());
          return selected?.textContent?.trim() || "";
        };
        rank = selectedFilterText("#rank-range-filter [role='radio'][aria-checked='true']") || rank;
        period = selectedFilterText("#time-range-filter [role='radio'][aria-checked='true']") || period;
        requireProfile();
        const matrix = document.querySelector(".ReactVirtualized__Grid.matchup-matrix");
        if (!matrix) throw new Error("Open the Matchups tab on the HSReplay meta page.");

        const labels = new Set();
        const metadata = new Map();
        const classSlugs = new Set([
          "deathknight", "demonhunter", "druid", "hunter", "mage", "paladin",
          "priest", "rogue", "shaman", "warlock", "warrior",
        ]);
        const numberValue = (value) => {
          const match = String(value || "").match(/-?\d+(?:[.,]\d+)?/);
          return match ? Number(match[0].replace(",", ".")) : null;
        };
        const gameValue = (value) => {
          const digits = String(value || "").replace(/\D/g, "");
          return digits ? Number(digits) : null;
        };
        const classSlug = (element) =>
          [...(element?.classList || [])].find((name) => classSlugs.has(name)) || "";
        const remember = (name, slug = "", popularity = null) => {
          if (!name) return;
          const current = metadata.get(name) || { name, classSlug: "", popularity: null };
          if (slug) current.classSlug = slug;
          if (Number.isFinite(popularity)) current.popularity = popularity;
          metadata.set(name, current);
        };
        const scanCells = () => {
          for (const cell of matrix.querySelectorAll(".matchup-cell")) {
            const ownElement = cell.querySelector(".tooltip-header.player-class");
            const opponentElement = [...cell.querySelectorAll("tr .player-class")].find(
              (element) => element !== ownElement,
            );
            const own = ownElement?.textContent?.trim();
            const opponent = opponentElement?.textContent?.trim();
            if (!own || !opponent) continue;
            let winRate = null;
            let games = null;
            for (const row of cell.querySelectorAll("tr")) {
              const value = row.querySelector("td")?.textContent?.trim() || "";
              if (value.includes("%")) winRate = numberValue(value);
              else if (!row.querySelector(".player-class")) games = gameValue(value);
            }
            if (!Number.isFinite(winRate) || !Number.isFinite(games)) continue;
            labels.add(`${own} versus ${opponent} - ${winRate}% ${games} games`);
            remember(own, classSlug(ownElement));
            remember(opponent, classSlug(opponentElement));
          }
        };
        const scanHeaders = () => {
          const namesByLeft = new Map();
          for (const header of document.querySelectorAll(".grid-container-top .matchup-column-header")) {
            const name = header.querySelector(".header-archetype-name")?.textContent?.trim();
            const left = Number.parseFloat(header.style.left || "");
            if (name && Number.isFinite(left)) {
              namesByLeft.set(left, name);
              remember(name);
            }
          }
          for (const footer of document.querySelectorAll(".grid-container-bottom .matchup-column-footer")) {
            const left = Number.parseFloat(footer.style.left || "");
            const name = namesByLeft.get(left);
            const popularity = numberValue(footer.querySelector(".bar-label")?.textContent);
            if (name && Number.isFinite(popularity)) remember(name, "", popularity);
          }
        };
        const offsets = (scrollSize, clientSize, cellSize) => {
          const maximum = Math.max(0, scrollSize - clientSize);
          const step = Math.max(cellSize, clientSize - cellSize);
          const result = [];
          for (let value = 0; value < maximum; value += step) result.push(value);
          result.push(maximum);
          return [...new Set(result.map((value) => Math.round(value)))];
        };
        const settle = () => new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 35))),
        );
        const originalLeft = matrix.scrollLeft;
        const originalTop = matrix.scrollTop;
        const horizontal = offsets(matrix.scrollWidth, matrix.clientWidth, 70);
        const vertical = offsets(matrix.scrollHeight, matrix.clientHeight, 40);
        for (const top of vertical) {
          for (const left of horizontal) {
            matrix.scrollLeft = left;
            matrix.scrollTop = top;
            matrix.dispatchEvent(new Event("scroll", { bubbles: true }));
            await settle();
            scanCells();
            scanHeaders();
          }
        }
        matrix.scrollLeft = originalLeft;
        matrix.scrollTop = originalTop;
        matrix.dispatchEvent(new Event("scroll", { bubbles: true }));
        if (!labels.size) throw new Error("HSReplay did not expose any matchup cells.");
        return {
          source: "HSReplay",
          sourceUrl: url.href,
          rank,
          period,
          capturedAt: new Date().toISOString(),
          labels: [...labels],
          archetypes: [...metadata.values()],
        };
      }
      throw new Error("Open an HSGuru matchup table or the HSReplay Matchups tab.");
    },
  });
  return result;
}

const classIds = [
  "deathknight", "demonhunter", "druid", "hunter", "mage", "paladin",
  "priest", "rogue", "shaman", "warlock", "warrior",
];

function inferClass(name) {
  const normalized = name.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.endsWith(" dk") || normalized.endsWith("death knight")) return "deathknight";
  if (normalized.endsWith(" dh") || normalized.endsWith("demon hunter")) return "demonhunter";
  if (normalized === "zoolock") return "warlock";
  return classIds.find((classId) => normalized === classId || normalized.endsWith(` ${classId}`)) || "";
}

function parseCapture(capture) {
  const pattern = /^(.+?) versus (.+?) - (\d+(?:[.,]\d+)?|N\/A)% ([\d,\s]+) games$/;
  const metadata = new Map(
    capture.archetypes.map((item) => [item.name, item]),
  );
  const cells = [];
  const rowGames = new Map();
  for (const label of capture.labels) {
    const match = String(label).trim().match(pattern);
    if (!match || match[3] === "N/A") continue;
    const [, deck, opponentDeck, rawWinRate, rawGames] = match;
    const games = Number(rawGames.replace(/[,\s]/g, ""));
    cells.push({ deck, opponentDeck, winRate: Number(rawWinRate.replace(",", ".")), games });
    rowGames.set(deck, (rowGames.get(deck) || 0) + games);
  }
  const totalGames = [...rowGames.values()].reduce((sum, value) => sum + value, 0);
  const details = (name) => {
    const item = metadata.get(name) || {};
    return {
      classId: item.classSlug || inferClass(name),
      popularity: Number.isFinite(item.popularity)
        ? item.popularity
        : totalGames > 0 ? (rowGames.get(name) || 0) / totalGames * 100 : null,
    };
  };
  const recognized = cells.filter((cell) => details(cell.deck).classId && details(cell.opponentDeck).classId);
  const names = new Set(recognized.flatMap((cell) => [cell.deck, cell.opponentDeck]));
  if (names.size < 4 || recognized.length < 4) {
    throw new Error("Fewer than four deck classes could be recognized in this table.");
  }
  return { cells: recognized, details, skipped: cells.length - recognized.length };
}

function csvValue(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(capture) {
  const { cells, details, skipped } = parseCapture(capture);
  const headers = [
    "format_version", "source", "captured_at", "rank", "period", "source_url",
    "deck", "deck_class", "opponent_deck", "opponent_class", "win_rate", "games",
    "deck_popularity", "opponent_popularity",
  ];
  const rows = cells.map((cell) => {
    const own = details(cell.deck);
    const opponent = details(cell.opponentDeck);
    return [
      1, capture.source, capture.capturedAt, capture.rank, capture.period, capture.sourceUrl,
      cell.deck, own.classId, cell.opponentDeck, opponent.classId, cell.winRate, cell.games,
      own.popularity == null ? "" : own.popularity.toFixed(4),
      opponent.popularity == null ? "" : opponent.popularity.toFixed(4),
    ].map(csvValue).join(",");
  });
  return { csv: [headers.join(","), ...rows].join("\r\n"), count: cells.length, skipped };
}

button.addEventListener("click", async () => {
  button.disabled = true;
  setStatus("Reading the open table…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("The active browser tab could not be found.");
    const capture = await collectActivePage(tab.id);
    const { csv, count, skipped } = buildCsv(capture);
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const date = capture.capturedAt.slice(0, 10);
    await chrome.downloads.download({
      url: blobUrl,
      filename: `pickwise-matchups-${capture.source.toLowerCase()}-${date}.csv`,
      saveAs: true,
    });
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
    setStatus(`Exported ${count} cells${skipped ? `; skipped ${skipped} with unknown classes` : ""}.`, "success");
  } catch (error) {
    setStatus(error?.message || String(error), "error");
    button.disabled = false;
  }
});
