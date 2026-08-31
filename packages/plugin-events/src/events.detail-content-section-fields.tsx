import { Button, Input, StudioField } from '@sva/studio-ui-react';

export type EventsContentTranslator = (key: string) => string;

export const ContentInput = ({
  id,
  label,
  value = '',
  type,
  ariaInvalid,
  description,
  error,
  required,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  value?: string | number;
  type?: 'date' | 'number' | 'time';
  ariaInvalid?: true;
  description?: string;
  error?: string;
  required?: boolean;
  onChange: (value: string) => void;
}>) => {
  const describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <StudioField
      id={id}
      label={label}
      description={description}
      error={error}
      required={required}
      controlProps={{
        id,
        ...(ariaInvalid ? { 'aria-invalid': true } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      }}
    >
      <Input
        id={id}
        type={type}
        aria-required={required ? true : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </StudioField>
  );
};

export const indexedId = (id: string, index: number) => (index === 0 ? id : `${id}-${index}`);
export const optionalText = (value: string | null | undefined) => value ?? '';
export const repeatedItemKey = (id: string | undefined, fallback: string) => id ?? fallback;

export const RepeaterItem = ({
  title,
  removeLabel,
  onRemove,
  children,
}: Readonly<{
  title: string;
  removeLabel: string;
  onRemove?: () => void;
  children: React.ReactNode;
}>) => (
  <div className="space-y-4 rounded-xl border border-border/60 p-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {onRemove ? (
        <Button type="button" size="sm" variant="secondary" onClick={onRemove}>
          {removeLabel}
        </Button>
      ) : null}
    </div>
    {children}
  </div>
);
