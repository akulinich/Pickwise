import { describe, expect, it } from "vitest";
import {
  importedDeckInput,
  importedMatrix,
  listImportedSnapshots,
  parseImportedCsv,
  saveImportedSnapshot,
} from "./importedMatchups";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const header = "format_version,source,captured_at,rank,period,source_url,deck,deck_class,opponent_deck,opponent_class,win_rate,games,deck_popularity,opponent_popularity";

function csv(capturedAt: string, firstWinRate = 61.2): string {
  const decks = [
    ["Cycle Rogue", "rogue"],
    ["Libram Paladin", "paladin"],
    ["Zarimi Priest", "priest"],
    ["Discover Hunter", "hunter"],
  ];
  const rows = decks.flatMap(([deck, deckClass], row) =>
    decks.map(([opponent, opponentClass], column) => [
      1,
      "HSReplay",
      capturedAt,
      "Legend",
      "Last 3 days",
      "https://hsreplay.net/meta/#tab=matchups",
      deck,
      deckClass,
      opponent,
      opponentClass,
      row === 0 && column === 1 ? firstWinRate : 50,
      200,
      12 - row,
      12 - column,
    ].join(",")),
  );
  return [header, ...rows].join("\n");
}

describe("imported matchup CSV", () => {
  it("parses a snapshot and builds a selected 4 × 4 matrix", () => {
    const snapshot = parseImportedCsv(csv("2026-11-18T12:00:00.000Z"));
    expect(snapshot.decks).toHaveLength(4);
    const decks = snapshot.decks.map(importedDeckInput);
    const result = importedMatrix(snapshot, decks, decks);
    expect(result.missing).toBe(0);
    const rogue = snapshot.decks.findIndex((deck) => deck.name === "Cycle Rogue");
    const paladin = snapshot.decks.findIndex((deck) => deck.name === "Libram Paladin");
    expect(result.matrix[rogue][paladin]).toBe(61.2);
  });

  it("keeps multiple captured datasets in local storage", () => {
    const storage = new MemoryStorage();
    saveImportedSnapshot(parseImportedCsv(csv("2026-11-17T12:00:00.000Z")), storage);
    saveImportedSnapshot(parseImportedCsv(csv("2026-11-18T12:00:00.000Z", 64)), storage);
    const snapshots = listImportedSnapshots(storage);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].capturedAt).toBe("2026-11-18T12:00:00.000Z");
    expect(snapshots[1].capturedAt).toBe("2026-11-17T12:00:00.000Z");
  });
});
