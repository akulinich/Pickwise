import { solve, type Model } from "yalps";

export const NUMERICAL_TOLERANCE = 1e-9;

export interface WeightedDeck {
  deck: number;
  probability: number;
}

export interface MatrixGameResult {
  value: number;
  rowStrategy: number[];
  columnStrategy: number[];
  primalValue: number;
  dualValue: number;
  gap: number;
}

export interface StateResult {
  myMask: number;
  opponentMask: number;
  myDecks: number[];
  opponentDecks: number[];
  value: number;
  myStrategy: WeightedDeck[];
  opponentStrategy: WeightedDeck[];
  qMatrix: number[][];
  primalValue?: number;
  dualValue?: number;
  gap?: number;
}

export interface ConquestSolution {
  matchupMatrix: number[][];
  myMask: number;
  opponentMask: number;
  states: Map<string, StateResult>;
  value: number;
  getState(myMask: number, opponentMask: number): StateResult;
}

export interface BanResult {
  value: number;
  myBanStrategy: WeightedDeck[];
  opponentBanStrategy: WeightedDeck[];
  payoffMatrix: number[][];
  postBanSolutions: Map<string, ConquestSolution>;
  game: MatrixGameResult;
  getPostBanSolution(ourBan: number, opponentBan: number): ConquestSolution;
}

function ensureRectangularFinite(matrix: readonly (readonly number[])[]): number[][] {
  if (matrix.length === 0 || matrix[0].length === 0) {
    throw new Error("The matrix must not be empty.");
  }
  const width = matrix[0].length;
  if (matrix.some((row) => row.length !== width)) {
    throw new Error("The matrix must be rectangular.");
  }
  if (matrix.some((row) => row.some((value) => !Number.isFinite(value)))) {
    throw new Error("The matrix must contain finite values only.");
  }
  return matrix.map((row) => [...row]);
}

function solutionVariables(entries: [string, number][]): Map<string, number> {
  return new Map(entries);
}

function normalizeStrategy(values: number[], tolerance: number): number[] {
  const cleaned = values.map((value) => {
    if (Math.abs(value) < tolerance) return 0;
    return value < 0 ? 0 : value;
  });
  const total = cleaned.reduce((sum, value) => sum + value, 0);
  if (total <= tolerance) {
    throw new Error("The LP solver returned an empty mixed strategy.");
  }
  return cleaned.map((value) => value / total);
}

function clampProbability(value: number, tolerance: number): number {
  if (value >= -tolerance && value <= 0) return 0;
  if (value >= 1 && value <= 1 + tolerance) return 1;
  return value;
}

export function solveMatrixGame(
  input: readonly (readonly number[])[],
  tolerance = NUMERICAL_TOLERANCE,
): MatrixGameResult {
  const q = ensureRectangularFinite(input);
  const rowCount = q.length;
  const columnCount = q[0].length;

  const rowConstraints: Record<string, { min?: number; max?: number; equal?: number }> = {
    sum: { equal: 1 },
    valueCap: { max: 1 },
  };
  const rowVariables: Record<string, Record<string, number>> = {};
  for (let column = 0; column < columnCount; column += 1) {
    rowConstraints[`column_${column}`] = { min: 0 };
  }
  for (let row = 0; row < rowCount; row += 1) {
    const coefficients: Record<string, number> = { sum: 1 };
    for (let column = 0; column < columnCount; column += 1) {
      coefficients[`column_${column}`] = q[row][column];
    }
    rowVariables[`x_${row}`] = coefficients;
  }
  rowVariables.value = {
    objective: 1,
    valueCap: 1,
    ...Object.fromEntries(
      Array.from({ length: columnCount }, (_, column) => [`column_${column}`, -1]),
    ),
  };

  const rowModel: Model<string, string> = {
    direction: "maximize",
    objective: "objective",
    constraints: rowConstraints,
    variables: rowVariables,
  };
  const rowSolution = solve(rowModel, {
    precision: tolerance,
    checkCycles: true,
    includeZeroVariables: true,
  });
  if (rowSolution.status !== "optimal") {
    throw new Error(`Row-player LP failed with status: ${rowSolution.status}.`);
  }

  const columnConstraints: Record<string, { min?: number; max?: number; equal?: number }> = {
    sum: { equal: 1 },
    valueCap: { max: 1 },
  };
  const columnVariables: Record<string, Record<string, number>> = {};
  for (let row = 0; row < rowCount; row += 1) {
    columnConstraints[`row_${row}`] = { max: 0 };
  }
  for (let column = 0; column < columnCount; column += 1) {
    const coefficients: Record<string, number> = { sum: 1 };
    for (let row = 0; row < rowCount; row += 1) {
      coefficients[`row_${row}`] = q[row][column];
    }
    columnVariables[`y_${column}`] = coefficients;
  }
  columnVariables.value = {
    objective: 1,
    valueCap: 1,
    ...Object.fromEntries(
      Array.from({ length: rowCount }, (_, row) => [`row_${row}`, -1]),
    ),
  };

  const columnModel: Model<string, string> = {
    direction: "minimize",
    objective: "objective",
    constraints: columnConstraints,
    variables: columnVariables,
  };
  const columnSolution = solve(columnModel, {
    precision: tolerance,
    checkCycles: true,
    includeZeroVariables: true,
  });
  if (columnSolution.status !== "optimal") {
    throw new Error(`Column-player LP failed with status: ${columnSolution.status}.`);
  }

  const rowValues = solutionVariables(rowSolution.variables);
  const columnValues = solutionVariables(columnSolution.variables);
  const rowStrategy = normalizeStrategy(
    Array.from({ length: rowCount }, (_, row) => rowValues.get(`x_${row}`) ?? 0),
    tolerance,
  );
  const columnStrategy = normalizeStrategy(
    Array.from({ length: columnCount }, (_, column) => columnValues.get(`y_${column}`) ?? 0),
    tolerance,
  );
  const primalValue = rowValues.get("value") ?? rowSolution.result;
  const dualValue = columnValues.get("value") ?? columnSolution.result;
  const gap = Math.abs(primalValue - dualValue);
  if (gap > Math.max(tolerance * 100, 1e-7)) {
    throw new Error(
      `Matrix-game primal and dual values disagree: ${primalValue} vs ${dualValue}.`,
    );
  }

  return {
    value: clampProbability((primalValue + dualValue) / 2, tolerance),
    rowStrategy,
    columnStrategy,
    primalValue,
    dualValue,
    gap,
  };
}

export function stateKey(myMask: number, opponentMask: number): string {
  return `${myMask}:${opponentMask}`;
}

export function postBanKey(ourBan: number, opponentBan: number): string {
  return `${ourBan}:${opponentBan}`;
}

export function indicesToMask(indices: Iterable<number>): number {
  let mask = 0;
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index > 30) {
      throw new Error(`Invalid deck index: ${index}.`);
    }
    mask |= 1 << index;
  }
  return mask;
}

export function maskToIndices(mask: number): number[] {
  const indices: number[] = [];
  for (let index = 0; index < 31; index += 1) {
    if ((mask & (1 << index)) !== 0) indices.push(index);
  }
  return indices;
}

export function popcount(mask: number): number {
  let value = mask >>> 0;
  let count = 0;
  while (value > 0) {
    value &= value - 1;
    count += 1;
  }
  return count;
}

function validateIndices(matrix: number[][], myMask: number, opponentMask: number): void {
  const rowCount = matrix.length;
  const columnCount = matrix[0].length;
  if (maskToIndices(myMask).some((index) => index >= rowCount)) {
    throw new Error("A deck index is outside the matchup matrix rows.");
  }
  if (maskToIndices(opponentMask).some((index) => index >= columnCount)) {
    throw new Error("An opponent deck index is outside the matchup matrix columns.");
  }
}

function validateProbabilityMatrix(matrix: readonly (readonly number[])[]): number[][] {
  const result = ensureRectangularFinite(matrix);
  if (result.some((row) => row.some((value) => value < 0 || value > 1))) {
    throw new Error("Matchup probabilities must be between 0 and 1.");
  }
  return result;
}

export function solveConquest(
  matchupMatrix: readonly (readonly number[])[],
  myDecks: Iterable<number>,
  opponentDecks: Iterable<number>,
): ConquestSolution {
  const matrix = validateProbabilityMatrix(matchupMatrix);
  const myMask = indicesToMask(myDecks);
  const opponentMask = indicesToMask(opponentDecks);
  validateIndices(matrix, myMask, opponentMask);
  const states = new Map<string, StateResult>();

  const visit = (remainingMine: number, remainingTheirs: number): StateResult => {
    const key = stateKey(remainingMine, remainingTheirs);
    const cached = states.get(key);
    if (cached) return cached;

    const mine = maskToIndices(remainingMine);
    const theirs = maskToIndices(remainingTheirs);
    if (remainingMine === 0) {
      const result: StateResult = {
        myMask: remainingMine,
        opponentMask: remainingTheirs,
        myDecks: mine,
        opponentDecks: theirs,
        value: 1,
        myStrategy: [],
        opponentStrategy: [],
        qMatrix: [],
      };
      states.set(key, result);
      return result;
    }
    if (remainingTheirs === 0) {
      const result: StateResult = {
        myMask: remainingMine,
        opponentMask: remainingTheirs,
        myDecks: mine,
        opponentDecks: theirs,
        value: 0,
        myStrategy: [],
        opponentStrategy: [],
        qMatrix: [],
      };
      states.set(key, result);
      return result;
    }

    const qMatrix = mine.map((myDeck) =>
      theirs.map((opponentDeck) => {
        const probability = matrix[myDeck][opponentDeck];
        const winChild = visit(remainingMine & ~(1 << myDeck), remainingTheirs).value;
        const lossChild = visit(remainingMine, remainingTheirs & ~(1 << opponentDeck)).value;
        return probability * winChild + (1 - probability) * lossChild;
      }),
    );
    const game = solveMatrixGame(qMatrix);
    const result: StateResult = {
      myMask: remainingMine,
      opponentMask: remainingTheirs,
      myDecks: mine,
      opponentDecks: theirs,
      value: game.value,
      myStrategy: mine.map((deck, index) => ({ deck, probability: game.rowStrategy[index] })),
      opponentStrategy: theirs.map((deck, index) => ({
        deck,
        probability: game.columnStrategy[index],
      })),
      qMatrix,
      primalValue: game.primalValue,
      dualValue: game.dualValue,
      gap: game.gap,
    };
    states.set(key, result);
    return result;
  };

  const root = visit(myMask, opponentMask);
  return {
    matchupMatrix: matrix,
    myMask,
    opponentMask,
    states,
    value: root.value,
    getState(requestedMyMask: number, requestedOpponentMask: number): StateResult {
      const state = states.get(stateKey(requestedMyMask, requestedOpponentMask));
      if (!state) throw new Error("State is outside this post-ban Conquest solution.");
      return state;
    },
  };
}

export function solveBans(
  matchupMatrix: readonly (readonly number[])[],
  myDecks: Iterable<number> = [0, 1, 2, 3],
  opponentDecks: Iterable<number> = [0, 1, 2, 3],
): BanResult {
  const matrix = validateProbabilityMatrix(matchupMatrix);
  const mine = [...new Set(myDecks)].sort((a, b) => a - b);
  const theirs = [...new Set(opponentDecks)].sort((a, b) => a - b);
  if (mine.length !== 4 || theirs.length !== 4) {
    throw new Error("The ban phase requires exactly four unique decks per player.");
  }
  validateIndices(matrix, indicesToMask(mine), indicesToMask(theirs));

  const payoffMatrix: number[][] = [];
  const postBanSolutions = new Map<string, ConquestSolution>();
  for (const ourBan of theirs) {
    const row: number[] = [];
    for (const opponentBan of mine) {
      const solution = solveConquest(
        matrix,
        mine.filter((deck) => deck !== opponentBan),
        theirs.filter((deck) => deck !== ourBan),
      );
      postBanSolutions.set(postBanKey(ourBan, opponentBan), solution);
      row.push(solution.value);
    }
    payoffMatrix.push(row);
  }

  const game = solveMatrixGame(payoffMatrix);
  return {
    value: game.value,
    myBanStrategy: theirs.map((deck, index) => ({
      deck,
      probability: game.rowStrategy[index],
    })),
    opponentBanStrategy: mine.map((deck, index) => ({
      deck,
      probability: game.columnStrategy[index],
    })),
    payoffMatrix,
    postBanSolutions,
    game,
    getPostBanSolution(ourBan: number, opponentBan: number): ConquestSolution {
      const solution = postBanSolutions.get(postBanKey(ourBan, opponentBan));
      if (!solution) throw new Error("No solution exists for this pair of bans.");
      return solution;
    },
  };
}

export function subsetsForMask(mask: number, minimumSize = 1): number[] {
  const values: number[] = [];
  for (let subset = mask; subset > 0; subset = (subset - 1) & mask) {
    if (popcount(subset) >= minimumSize) values.push(subset);
  }
  return values.sort((left, right) => {
    const sizeDifference = popcount(right) - popcount(left);
    return sizeDifference !== 0 ? sizeDifference : left - right;
  });
}

export function recommendedBan(strategy: readonly WeightedDeck[]): number {
  if (strategy.length === 0) throw new Error("Ban strategy is empty.");
  return strategy.reduce((best, candidate) =>
    candidate.probability > best.probability + NUMERICAL_TOLERANCE ? candidate : best,
  ).deck;
}
