import {
  HEARTHSTONE_CLASSES,
  cloneInput,
  validateInput,
  type HearthstoneClass,
  type SolverInput,
} from "../domain/model";

const STORAGE_KEY = "pickwise.saved-matches.v1";
const ACTIVE_MATCH_KEY = "pickwise.active-match.v1";
const STORAGE_VERSION = 1;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export interface SavedMatch {
  id: string;
  name: string;
  updatedAt: string;
  input: SolverInput;
}

interface SavedMatchStore {
  version: typeof STORAGE_VERSION;
  matches: SavedMatch[];
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

function matchId(name: string): string {
  return name.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

function isClassId(value: unknown): value is HearthstoneClass {
  return typeof value === "string" && validClassIds.has(value);
}

function isSolverInput(value: unknown): value is SolverInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<SolverInput>;
  if (
    typeof input.eventName !== "string" ||
    !Array.isArray(input.myDecks) ||
    !Array.isArray(input.opponentDecks) ||
    !Array.isArray(input.matrix)
  ) {
    return false;
  }
  const decksAreValid = [...input.myDecks, ...input.opponentDecks].every(
    (deck) =>
      Boolean(deck) &&
      typeof deck === "object" &&
      isClassId((deck as { classId?: unknown }).classId),
  );
  const normalized = {
    ...input,
    dataSource: input.dataSource ?? "none",
  } as SolverInput;
  return decksAreValid && validateInput(normalized).length === 0;
}

function isSavedMatch(value: unknown): value is SavedMatch {
  if (!value || typeof value !== "object") return false;
  const match = value as Partial<SavedMatch>;
  return (
    typeof match.id === "string" &&
    typeof match.name === "string" &&
    typeof match.updatedAt === "string" &&
    isSolverInput(match.input)
  );
}

function readStore(storage: StorageLike | null = browserStorage()): SavedMatchStore {
  if (!storage) return { version: STORAGE_VERSION, matches: [] };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { version: STORAGE_VERSION, matches: [] };
    const parsed = JSON.parse(raw) as Partial<SavedMatchStore>;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.matches)) {
      return { version: STORAGE_VERSION, matches: [] };
    }
    return {
      version: STORAGE_VERSION,
      matches: parsed.matches.filter(isSavedMatch).map((match) => ({
        ...match,
        input: cloneInput({ ...match.input, dataSource: match.input.dataSource ?? "none" }),
      })),
    };
  } catch {
    return { version: STORAGE_VERSION, matches: [] };
  }
}

function writeStore(store: SavedMatchStore, storage: StorageLike | null = browserStorage()): void {
  if (!storage) throw new Error("Local storage is not available in this browser.");
  storage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listSavedMatches(storage: StorageLike | null = browserStorage()): SavedMatch[] {
  return readStore(storage).matches.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export function saveMatch(
  input: SolverInput,
  storage: StorageLike | null = browserStorage(),
): SavedMatch {
  const validationErrors = validateInput(input);
  if (validationErrors.length > 0) throw new Error(validationErrors[0]);
  const name = input.eventName.trim();
  const saved: SavedMatch = {
    id: matchId(name),
    name,
    updatedAt: new Date().toISOString(),
    input: cloneInput({ ...input, eventName: name }),
  };
  const current = readStore(storage).matches.filter((match) => match.id !== saved.id);
  writeStore({ version: STORAGE_VERSION, matches: [saved, ...current] }, storage);
  return saved;
}

export function loadMatch(
  id: string,
  storage: StorageLike | null = browserStorage(),
): SavedMatch | null {
  const match = readStore(storage).matches.find((candidate) => candidate.id === id);
  return match ? { ...match, input: cloneInput(match.input) } : null;
}

export function deleteMatch(
  id: string,
  storage: StorageLike | null = browserStorage(),
): void {
  const store = readStore(storage);
  writeStore(
    { ...store, matches: store.matches.filter((match) => match.id !== id) },
    storage,
  );
}

export function getActiveMatchId(
  storage: StorageLike | null = browserStorage(),
): string {
  if (!storage) return "";
  try {
    return storage.getItem(ACTIVE_MATCH_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setActiveMatchId(
  id: string,
  storage: StorageLike | null = browserStorage(),
): void {
  if (!storage) throw new Error("Local storage is not available in this browser.");
  storage.setItem(ACTIVE_MATCH_KEY, id);
}

export function clearActiveMatchId(
  storage: StorageLike | null = browserStorage(),
): void {
  setActiveMatchId("", storage);
}

