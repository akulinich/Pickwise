import { classIconUrl } from "../domain/model";
import type { ImportedDeck } from "../storage/importedMatchups";

interface ImportedDeckPickerProps {
  value: string;
  label: string;
  decks: ImportedDeck[];
  onChange(id: string): void;
}

const deckNameCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

export function ImportedDeckPicker({ value, label, decks, onChange }: ImportedDeckPickerProps) {
  const sortedDecks = [...decks].sort(
    (left, right) =>
      deckNameCollator.compare(left.name, right.name) ||
      deckNameCollator.compare(left.id, right.id),
  );
  const selected = decks.find((deck) => deck.id === value) ?? sortedDecks[0];
  return (
    <label className="class-picker imported-deck-picker">
      {selected && <img src={classIconUrl(selected.classId)} alt="" className="class-icon" />}
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={selected?.id ?? ""} title={selected?.name} onChange={(event) => onChange(event.target.value)}>
        {sortedDecks.map((deck) => (
          <option key={deck.id} value={deck.id}>{deck.name}</option>
        ))}
      </select>
    </label>
  );
}
