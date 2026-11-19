import { classIconUrl } from "../domain/model";
import type { ImportedDeck } from "../storage/importedMatchups";

interface ImportedDeckPickerProps {
  value: string;
  label: string;
  decks: ImportedDeck[];
  onChange(id: string): void;
}

export function ImportedDeckPicker({ value, label, decks, onChange }: ImportedDeckPickerProps) {
  const selected = decks.find((deck) => deck.id === value) ?? decks[0];
  return (
    <label className="class-picker imported-deck-picker">
      {selected && <img src={classIconUrl(selected.classId)} alt="" className="class-icon" />}
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={selected?.id ?? ""} title={selected?.name} onChange={(event) => onChange(event.target.value)}>
        {decks.map((deck) => (
          <option key={deck.id} value={deck.id}>{deck.name}</option>
        ))}
      </select>
    </label>
  );
}
