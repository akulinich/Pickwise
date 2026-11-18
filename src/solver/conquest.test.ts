import { describe, expect, it } from "vitest";
import {
  recommendedBan,
  solveBans,
  solveConquest,
  solveMatrixGame,
} from "./conquest";

describe("solveMatrixGame", () => {
  it("solves a known 2x2 zero-sum game", () => {
    const result = solveMatrixGame([
      [0.7, 0.3],
      [0.4, 0.6],
    ]);
    expect(result.value).toBeCloseTo(0.5, 8);
    expect(result.rowStrategy[0]).toBeCloseTo(1 / 3, 8);
    expect(result.rowStrategy[1]).toBeCloseTo(2 / 3, 8);
    expect(result.columnStrategy.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 9);
    expect(result.gap).toBeLessThan(1e-7);
  });
});

describe("solveConquest", () => {
  it("returns the matchup probability for a 1x1 state", () => {
    expect(solveConquest([[0.73]], [0], [0]).value).toBeCloseTo(0.73, 9);
  });

  it("solves all 63 reachable states for a 3x3 match", () => {
    const matrix = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => 0.5));
    const solution = solveConquest(matrix, [0, 1, 2], [0, 1, 2]);
    expect(solution.value).toBeCloseTo(0.5, 8);
    expect(solution.states.size).toBe(63);
  });

  it("normalizes every non-terminal strategy and satisfies both LP sides", () => {
    const matrix = [
      [0.7, 0.4, 0.6],
      [0.3, 0.8, 0.5],
      [0.55, 0.45, 0.65],
    ];
    const solution = solveConquest(matrix, [0, 1, 2], [0, 1, 2]);
    for (const state of solution.states.values()) {
      if (state.qMatrix.length === 0) continue;
      expect(state.myStrategy.reduce((sum, item) => sum + item.probability, 0)).toBeCloseTo(1, 8);
      expect(state.opponentStrategy.reduce((sum, item) => sum + item.probability, 0)).toBeCloseTo(
        1,
        8,
      );
      for (let column = 0; column < state.opponentDecks.length; column += 1) {
        const guaranteed = state.myStrategy.reduce(
          (sum, item, row) => sum + item.probability * state.qMatrix[row][column],
          0,
        );
        expect(guaranteed).toBeGreaterThanOrEqual(state.value - 1e-7);
      }
      for (let row = 0; row < state.myDecks.length; row += 1) {
        const capped = state.opponentStrategy.reduce(
          (sum, item, column) => sum + item.probability * state.qMatrix[row][column],
          0,
        );
        expect(capped).toBeLessThanOrEqual(state.value + 1e-7);
      }
    }
  });
});

describe("solveBans", () => {
  const matrix = [
    [0.55, 0.42, 0.61, 0.5],
    [0.48, 0.63, 0.45, 0.57],
    [0.7, 0.38, 0.52, 0.46],
    [0.51, 0.55, 0.49, 0.6],
  ];

  it("uses each post-ban V33 value in the ban payoff matrix", () => {
    const result = solveBans(matrix);
    for (let ourBan = 0; ourBan < 4; ourBan += 1) {
      for (let opponentBan = 0; opponentBan < 4; opponentBan += 1) {
        expect(result.payoffMatrix[ourBan][opponentBan]).toBeCloseTo(
          result.getPostBanSolution(ourBan, opponentBan).value,
          9,
        );
      }
    }
  });

  it("chooses the first highest-weight ban deterministically", () => {
    const result = solveBans(Array.from({ length: 4 }, () => Array(4).fill(0.5)));
    expect(recommendedBan(result.myBanStrategy)).toBe(0);
  });
});
