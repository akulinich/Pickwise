import { describe, expect, it } from "vitest";
import { matchupInputColor } from "./format";

describe("matchup input colors", () => {
  it("makes 55% as strong as the old 70% and reaches a brighter maximum", () => {
    expect(matchupInputColor(50)).toBe("#0e1624");
    expect(matchupInputColor(55)).toBe("rgba(69, 191, 131, 0.34)");
    expect(matchupInputColor(70)).toBe("rgba(69, 191, 131, 0.82)");
    expect(matchupInputColor(100)).toBe(matchupInputColor(70));
    expect(matchupInputColor(45)).toBe("rgba(239, 100, 100, 0.34)");
    expect(matchupInputColor(30)).toBe("rgba(239, 100, 100, 0.82)");
    expect(matchupInputColor(0)).toBe(matchupInputColor(30));
  });
});
