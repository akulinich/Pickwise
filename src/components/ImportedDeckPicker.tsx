import {
  HEARTHSTONE_CLASSES,
  classIconUrl,
  className,
  type DeckInput,
  type HearthstoneClass,
} from "../domain/model";
import type { ImportedDeck } from "../storage/importedMatchups";

export type ImportedDeckChoice =
  | { kind: "imported"; id: string }
  | { kind: "class"; classId: HearthstoneClass };

interface ImportedDeckPickerProps {
  value: DeckInput;
  label: string;
  decks: ImportedDeck[];
  onChange(choice: ImportedDeckChoice): void;
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
  const selected = value.importedId
    ? decks.find((deck) => deck.id === value.importedId)
    : undefined;
  const selectedValue = selected ? `imported:${selected.id}` : `class:${value.classId}`;
  const selectedClass = selected?.classId ?? value.classId;
  const selectedName = selected?.name ?? className(value.classId);

  const handleChange = (raw: string) => {
    if (raw.startsWith("imported:")) {
      onChange({ kind: "imported", id: raw.slice("imported:".length) });
      return;
    }
    const classId = raw.slice("class:".length);
    if (HEARTHSTONE_CLASSES.some((item) => item.id === classId)) {
      onChange({ kind: "class", classId: classId as HearthstoneClass });
    }
  };

  return (
    <label className="class-picker imported-deck-picker">
      <img src={classIconUrl(selectedClass)} alt="" className="class-icon" />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={selectedValue}
        title={selectedName}
        onChange={(event) => handleChange(event.target.value)}
      >
        <optgroup label="Imported decks">
          {sortedDecks.map((deck) => (
            <option key={deck.id} value={`imported:${deck.id}`}>{deck.name}</option>
          ))}
        </optgroup>
        <optgroup label="Classes · manual">
          {HEARTHSTONE_CLASSES.map((item) => (
            <option key={item.id} value={`class:${item.id}`}>{item.name}</option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
