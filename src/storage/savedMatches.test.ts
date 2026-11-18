import { describe, expect, it } from "vitest";
import { createDefaultInput } from "../domain/model";
import { deleteMatch, listSavedMatches, loadMatch, saveMatch } from "./savedMatches";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("saved matches", () => {
  it("saves, loads, updates, and deletes a calculation by match name", () => {
    const storage = new MemoryStorage();
    const input = createDefaultInput();
    input.eventName = "Qualifier vs Alex";
    input.matrix[0][0] = 67;

    const first = saveMatch(input, storage);
    expect(listSavedMatches(storage)).toHaveLength(1);
    expect(loadMatch(first.id, storage)?.input.matrix[0][0]).toBe(67);

    input.eventName = "qualifier vs alex";
    input.matrix[0][0] = 71;
    const updated = saveMatch(input, storage);
    expect(updated.id).toBe(first.id);
    expect(listSavedMatches(storage)).toHaveLength(1);
    expect(loadMatch(first.id, storage)?.input.matrix[0][0]).toBe(71);

    deleteMatch(first.id, storage);
    expect(listSavedMatches(storage)).toEqual([]);
  });

  it("ignores malformed local data", () => {
    const storage = new MemoryStorage();
    storage.setItem("pickwise.saved-matches.v1", "not json");
    expect(listSavedMatches(storage)).toEqual([]);
  });

  it("loads legacy matches and removes the old display-threshold setting", () => {
    const storage = new MemoryStorage();
    const legacyInput = { ...createDefaultInput(), displayThreshold: 25 };
    storage.setItem(
      "pickwise.saved-matches.v1",
      JSON.stringify({
        version: 1,
        matches: [
          {
            id: "legacy match",
            name: "Legacy match",
            updatedAt: "2026-01-01T00:00:00.000Z",
            input: legacyInput,
          },
        ],
      }),
    );

    const [match] = listSavedMatches(storage);
    expect(match.name).toBe("Legacy match");
    expect(match.input).not.toHaveProperty("displayThreshold");
  });
});

