import { deckName, type DeckInput } from "../domain/model";
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
    .map((index) => decks[index] ? deckName(decks[index]) : `Deck ${index + 1}`)
    .join(" + ");
}

export function strategyLabel(
  strategy: readonly WeightedDeck[],
  decks: readonly DeckInput[],
  threshold = 0,
): string {
  const visible = strategy.filter((item) => item.probability + 1e-12 >= threshold);
  if (visible.length === 0) return "—";
  return visible
    .map((item) => `${decks[item.deck] ? deckName(decks[item.deck]) : `Deck ${item.deck + 1}`} ${formatPercent(item.probability, 1)}`)
    .join(" · ");
}

export function heatColor(value: number): string {
  return matchupInputColor(value * 100);
}

export function matchupInputColor(percent: number): string {
  const neutral = [255, 244, 214];
  if (!Number.isFinite(percent) || Math.abs(percent - 50) < 1e-12) return "#fff4d6";
  const target = percent > 50 ? [160, 226, 107] : [255, 155, 135];
  const intensity = Math.min(1, Math.abs(percent - 50) / 15);
  const channels = neutral.map((channel, index) =>
    Math.round(channel + (target[index] - channel) * intensity),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
