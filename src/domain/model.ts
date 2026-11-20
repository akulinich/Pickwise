export const HEARTHSTONE_CLASSES = [
  { id: "deathknight", name: "Death Knight" },
  { id: "demonhunter", name: "Demon Hunter" },
  { id: "druid", name: "Druid" },
  { id: "hunter", name: "Hunter" },
  { id: "mage", name: "Mage" },
  { id: "paladin", name: "Paladin" },
  { id: "priest", name: "Priest" },
  { id: "rogue", name: "Rogue" },
  { id: "shaman", name: "Shaman" },
  { id: "warlock", name: "Warlock" },
  { id: "warrior", name: "Warrior" },
] as const;

export type HearthstoneClass = (typeof HEARTHSTONE_CLASSES)[number]["id"];

export interface DeckInput {
  classId: HearthstoneClass;
  name?: string;
  importedId?: string;
}

export type MatchupDataSource = "none" | "imported";

export interface SolverInput {
  eventName: string;
  dataSource: MatchupDataSource;
  importedSnapshotId?: string;
  myDecks: DeckInput[];
  opponentDecks: DeckInput[];
  matrix: number[][];
}

export const MIN_VISIBLE_PICK_PROBABILITY = 0.005;

export function className(classId: HearthstoneClass): string {
  return HEARTHSTONE_CLASSES.find((item) => item.id === classId)?.name ?? classId;
}

export function deckName(deck: DeckInput): string {
  return deck.name?.trim() || className(deck.classId);
}

export function classIconUrl(classId: HearthstoneClass): string {
  return `${import.meta.env.BASE_URL}class-icons/${classId}.png`;
}

export function createDefaultInput(): SolverInput {
  const myClasses: HearthstoneClass[] = ["warrior", "mage", "rogue", "druid"];
  const opponentClasses: HearthstoneClass[] = ["paladin", "shaman", "priest", "hunter"];
  return {
    eventName: "Conquest match",
    dataSource: "none",
    myDecks: myClasses.map((classId) => ({ classId })),
    opponentDecks: opponentClasses.map((classId) => ({ classId })),
    matrix: [
      [55, 42, 61, 50],
      [48, 63, 45, 57],
      [70, 38, 52, 46],
      [51, 55, 49, 60],
    ],
  };
}

export function cloneInput(input: SolverInput): SolverInput {
  return {
    eventName: input.eventName,
    dataSource: input.dataSource ?? "none",
    importedSnapshotId: input.importedSnapshotId,
    myDecks: input.myDecks.map((deck) => ({ ...deck })),
    opponentDecks: input.opponentDecks.map((deck) => ({ ...deck })),
    matrix: input.matrix.map((row) => [...row]),
  };
}

export function validateInput(input: SolverInput): string[] {
  const errors: string[] = [];
  if (!input.eventName.trim()) {
    errors.push("Sheet title is required so the calculation can be saved.");
  }
  if (input.dataSource !== "none" && input.dataSource !== "imported") {
    errors.push("Choose a valid matchup data source.");
  }
  if (input.dataSource === "imported" && !input.importedSnapshotId) {
    errors.push("Choose an imported dataset.");
  }
  if (input.myDecks.length !== 4 || input.opponentDecks.length !== 4) {
    errors.push("Each lineup must contain exactly four decks.");
  }
  if (input.matrix.length !== 4 || input.matrix.some((row) => row.length !== 4)) {
    errors.push("The matchup matrix must be 4 × 4.");
  } else if (
    input.matrix.some((row) =>
      row.some((value) => !Number.isFinite(value) || value < 0 || value > 100),
    )
  ) {
    errors.push("Every matchup must be a number from 0 to 100.");
  }
  return errors;
}

export function probabilityMatrix(input: SolverInput): number[][] {
  return input.matrix.map((row) => row.map((value) => value / 100));
}
