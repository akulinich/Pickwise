import { describe, expect, it } from "vitest";
import { matchupInputColor } from "./format";

describe("matchup input colors", () => {
  it("makes 55% as strong as the old 70% and reaches a brighter maximum", () => {
    expect(matchupInputColor(50)).toBe("#fff4d6");
    expect(matchupInputColor(55)).toBe("#dfeeb2");
    expect(matchupInputColor(70)).toBe("#a0e26b");
    expect(matchupInputColor(100)).toBe(matchupInputColor(70));
    expect(matchupInputColor(45)).toBe("#ffd6bc");
    expect(matchupInputColor(30)).toBe("#ff9b87");
    expect(matchupInputColor(0)).toBe(matchupInputColor(30));
  });
});
