import {
  HEARTHSTONE_CLASSES,
  classIconUrl,
  className,
  type HearthstoneClass,
} from "../domain/model";

interface ClassPickerProps {
  value: HearthstoneClass;
  label: string;
  onChange(value: HearthstoneClass): void;
}

export function ClassPicker({ value, label, onChange }: ClassPickerProps) {
  return (
    <label className="class-picker">
      <img src={classIconUrl(value)} alt="" className="class-icon" />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        title={className(value)}
        onChange={(event) => onChange(event.target.value as HearthstoneClass)}
      >
        {HEARTHSTONE_CLASSES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
