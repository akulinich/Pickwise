import type { DeckInput } from "../domain/model";
import { maskToIndices, type WeightedDeck } from "../solver/conquest";

export function formatPercent(value: number, digits = 1): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatProbabilityInput(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function stateLabel(mask: number, decks: readonly DeckInput[]): string {
  if (mask === 0) return "∅";
  return maskToIndices(mask)
    .map((index) => decks[index]?.alias || `#${index + 1}`)
    .join("");
}

export function strategyLabel(
  strategy: readonly WeightedDeck[],
  decks: readonly DeckInput[],
  threshold = 0,
): string {
  const visible = strategy.filter((item) => item.probability + 1e-12 >= threshold);
  if (visible.length === 0) return "—";
  return visible
    .map((item) => `${decks[item.deck]?.alias ?? item.deck + 1} ${formatPercent(item.probability, 1)}`)
    .join(" · ");
}

export function heatColor(value: number): string {
  const distance = Math.min(1, Math.abs(value - 0.5) / 0.28);
  if (value >= 0.5) return `rgba(69, 191, 131, ${0.08 + distance * 0.25})`;
  return `rgba(239, 100, 100, ${0.08 + distance * 0.25})`;
}
