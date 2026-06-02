import * as React from 'react';

export const FilterSelect = ({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (value: string) => void;
}>) => (
  <label className="field">
    <span className="field__label">{label}</span>
    <select className="field__control" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);
