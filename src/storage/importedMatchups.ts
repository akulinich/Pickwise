import {
  HEARTHSTONE_CLASSES,
  type DeckInput,
  type HearthstoneClass,
} from "../domain/model";

const STORAGE_KEY = "pickwise.imported-matchups.v1";
const STORAGE_VERSION = 1;
const REQUIRED_COLUMNS = [
  "source",
  "captured_at",
  "rank",
  "period",
  "source_url",
  "deck",
  "deck_class",
  "opponent_deck",
  "opponent_class",
  "win_rate",
  "games",
] as const;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

interface ImportedSnapshotStore {
  version: typeof STORAGE_VERSION;
  snapshots: ImportedSnapshot[];
}

export interface ImportedDeck {
  id: string;
  name: string;
  classId: HearthstoneClass;
  popularity: number | null;
}

export interface ImportedMatchup {
  deckId: string;
  opponentDeckId: string;
  winRate: number;
  games: number;
}

export interface ImportedSnapshot {
  version: typeof STORAGE_VERSION;
  id: string;
  source: string;
  capturedAt: string;
  rank: string;
  period: string;
  sourceUrl: string;
  decks: ImportedDeck[];
  matchups: ImportedMatchup[];
}

const validClassIds = new Set<string>(HEARTHSTONE_CLASSES.map((item) => item.id));

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value.replace(/\r$/, ""));
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (quoted) throw new Error("The CSV contains an unfinished quoted value.");
  return rows;
}

function deckId(name: string): string {
  return name.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

function numberValue(raw: string, label: string): number {
  const value = Number(raw.trim());
  if (!Number.isFinite(value)) throw new Error(`Invalid ${label} value in the CSV.`);
  return value;
}

function isClassId(value: string): value is HearthstoneClass {
  return validClassIds.has(value);
}

export function parseImportedCsv(text: string): ImportedSnapshot {
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error("The CSV does not contain matchup rows.");
  const headers = rows[0].map((value) => value.trim().toLocaleLowerCase("en-US"));
  for (const required of REQUIRED_COLUMNS) {
    if (!headers.includes(required)) {
      throw new Error(`This is not a Pickwise matchup CSV: missing “${required}”.`);
    }
  }
  const indexOf = (column: string) => headers.indexOf(column);
  const deckPopularityColumn = indexOf("deck_popularity");
  const opponentPopularityColumn = indexOf("opponent_popularity");
  const decks = new Map<string, ImportedDeck>();
  const matchups = new Map<string, ImportedMatchup>();
  let metadata: Pick<ImportedSnapshot, "source" | "capturedAt" | "rank" | "period" | "sourceUrl"> | null = null;

  const rememberDeck = (name: string, classId: string, popularityRaw: string) => {
    const id = deckId(name);
    if (!id || !isClassId(classId)) return null;
    const popularity = popularityRaw.trim() === "" ? null : Number(popularityRaw);
    const existing = decks.get(id);
    if (existing && existing.classId !== classId) {
      throw new Error(`Deck “${name}” has conflicting classes in the CSV.`);
    }
    decks.set(id, {
      id,
      name: name.trim(),
      classId,
      popularity: Number.isFinite(popularity) ? popularity : existing?.popularity ?? null,
    });
    return id;
  };

  for (const row of rows.slice(1)) {
    const value = (column: string) => row[indexOf(column)]?.trim() ?? "";
    if (!metadata) {
      metadata = {
        source: value("source"),
        capturedAt: value("captured_at"),
        rank: value("rank"),
        period: value("period"),
        sourceUrl: value("source_url"),
      };
    }
    const ownId = rememberDeck(
      value("deck"),
      value("deck_class").toLocaleLowerCase("en-US"),
      deckPopularityColumn >= 0 ? row[deckPopularityColumn] ?? "" : "",
    );
    const opponentId = rememberDeck(
      value("opponent_deck"),
      value("opponent_class").toLocaleLowerCase("en-US"),
      opponentPopularityColumn >= 0 ? row[opponentPopularityColumn] ?? "" : "",
    );
    if (!ownId || !opponentId) continue;
    const winRate = numberValue(value("win_rate"), "win rate");
    const games = numberValue(value("games"), "games");
    if (winRate < 0 || winRate > 100 || games < 0) {
      throw new Error("Win rates must be 0–100 and games cannot be negative.");
    }
    matchups.set(`${ownId}\u0000${opponentId}`, { deckId: ownId, opponentDeckId: opponentId, winRate, games });
  }

  if (!metadata?.source || !metadata.capturedAt) {
    throw new Error("The CSV is missing its source metadata.");
  }
  if (decks.size < 4 || matchups.size < 4) {
    throw new Error("The CSV needs at least four recognized decks and four matchup cells.");
  }
  const sortedDecks = [...decks.values()].sort((left, right) =>
    (right.popularity ?? -1) - (left.popularity ?? -1) || left.name.localeCompare(right.name),
  );
  return {
    version: STORAGE_VERSION,
    id: `${metadata.source}:${metadata.capturedAt}`,
    ...metadata,
    decks: sortedDecks,
    matchups: [...matchups.values()],
  };
}

function isSnapshot(value: unknown): value is ImportedSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ImportedSnapshot>;
  return (
    snapshot.version === STORAGE_VERSION &&
    typeof snapshot.id === "string" &&
    typeof snapshot.source === "string" &&
    typeof snapshot.capturedAt === "string" &&
    Array.isArray(snapshot.decks) &&
    snapshot.decks.length >= 4 &&
    snapshot.decks.every((deck) => deck && typeof deck.name === "string" && isClassId(deck.classId)) &&
    Array.isArray(snapshot.matchups)
  );
}

function readStore(storage: StorageLike | null): ImportedSnapshotStore {
  if (!storage) return { version: STORAGE_VERSION, snapshots: [] };
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (isSnapshot(parsed)) {
      return { version: STORAGE_VERSION, snapshots: [parsed] };
    }
    if (!parsed || typeof parsed !== "object") return { version: STORAGE_VERSION, snapshots: [] };
    const store = parsed as Partial<ImportedSnapshotStore>;
    if (store.version !== STORAGE_VERSION || !Array.isArray(store.snapshots)) {
      return { version: STORAGE_VERSION, snapshots: [] };
    }
    return { version: STORAGE_VERSION, snapshots: store.snapshots.filter(isSnapshot) };
  } catch {
    return { version: STORAGE_VERSION, snapshots: [] };
  }
}

export function saveImportedSnapshot(
  snapshot: ImportedSnapshot,
  storage: StorageLike | null = browserStorage(),
): void {
  if (!storage) throw new Error("Local storage is not available in this browser.");
  const current = readStore(storage).snapshots.filter((item) => item.id !== snapshot.id);
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: STORAGE_VERSION, snapshots: [snapshot, ...current] }),
  );
}

export function listImportedSnapshots(
  storage: StorageLike | null = browserStorage(),
): ImportedSnapshot[] {
  return readStore(storage).snapshots.sort((left, right) =>
    right.capturedAt.localeCompare(left.capturedAt),
  );
}

export function importedDeckInput(deck: ImportedDeck): DeckInput {
  return { classId: deck.classId, name: deck.name, importedId: deck.id };
}

export function importedMatrix(
  snapshot: ImportedSnapshot,
  myDecks: readonly DeckInput[],
  opponentDecks: readonly DeckInput[],
): { matrix: number[][]; missing: number } {
  const cells = new Map(
    snapshot.matchups.map((cell) => [`${cell.deckId}\u0000${cell.opponentDeckId}`, cell.winRate]),
  );
  let missing = 0;
  const matrix = myDecks.map((mine) =>
    opponentDecks.map((opponent) => {
      const direct = cells.get(`${mine.importedId}\u0000${opponent.importedId}`);
      if (direct !== undefined) return direct;
      const reverse = cells.get(`${opponent.importedId}\u0000${mine.importedId}`);
      if (reverse !== undefined) return 100 - reverse;
      missing += 1;
      return 50;
    }),
  );
  return { matrix, missing };
}
