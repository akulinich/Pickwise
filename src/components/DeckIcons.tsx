import { classIconUrl, deckName, type DeckInput } from "../domain/model";
import { maskToIndices, type WeightedDeck } from "../solver/conquest";
import { formatPercent } from "../utils/format";

export function DeckIcon({ deck, className = "" }: { deck: DeckInput; className?: string }) {
  const name = deckName(deck);
  return (
    <span className={`deck-icon ${className}`.trim()} title={name} aria-label={name}>
      <img src={classIconUrl(deck.classId)} alt="" />
    </span>
  );
}

export function DeckSet({ mask, decks }: { mask: number; decks: readonly DeckInput[] }) {
  const indices = maskToIndices(mask);
  if (indices.length === 0) return <span aria-label="Empty set">∅</span>;
  const label = indices.map((index) => deckName(decks[index])).join(", ");
  return (
    <span className="deck-icon-set" aria-label={label} title={label}>
      {indices.map((index) => (
        <img key={index} src={classIconUrl(decks[index].classId)} alt="" />
      ))}
    </span>
  );
}

export function StrategyMix({
  strategy,
  decks,
  threshold = 0,
}: {
  strategy: readonly WeightedDeck[];
  decks: readonly DeckInput[];
  threshold?: number;
}) {
  const visible = strategy.filter((item) => item.probability + 1e-12 >= threshold);
  if (visible.length === 0) return <span>—</span>;
  return (
    <span className="strategy-mix">
      {visible.map((item) => (
        <span className="strategy-pick" key={item.deck} title={deckName(decks[item.deck])}>
          <img src={classIconUrl(decks[item.deck].classId)} alt="" />
          <span>{formatPercent(item.probability, 1)}</span>
        </span>
      ))}
    </span>
  );
}
