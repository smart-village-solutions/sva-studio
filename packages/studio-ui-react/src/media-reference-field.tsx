import { Button } from './button.js';
import { Select } from './select.js';
import { StudioField } from './studio-primitives.js';

export type MediaReferenceFieldOption = Readonly<{
  assetId: string;
  label: string;
}>;

export type MediaReferenceFieldProps = Readonly<{
  id: string;
  label: string;
  value: string | null;
  options: readonly MediaReferenceFieldOption[];
  onChange: (assetId: string | null) => void;
  placeholder: string;
  clearLabel?: string;
}>;

export const MediaReferenceField = ({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
  clearLabel,
}: MediaReferenceFieldProps) => {
  return (
    <StudioField id={id} label={label}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          id={id}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.assetId} value={option.assetId}>
              {option.label}
            </option>
          ))}
        </Select>
        {clearLabel ? (
          <Button type="button" variant="outline" onClick={() => onChange(null)}>
            {clearLabel}
          </Button>
        ) : null}
      </div>
    </StudioField>
  );
};
