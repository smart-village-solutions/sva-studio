import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';
import { useEffect, useState, type ReactNode } from 'react';

export const WasteListFilterDialog = ({
  id,
  title,
  description,
  open,
  onOpenChange,
  onReset,
  onApply,
  disabled,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onReset: () => void;
  readonly onApply: () => void;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label={title}
        aria-labelledby={undefined}
        aria-describedby={`${id}-description`}
        className="flex flex-col gap-4 overflow-hidden max-w-[35rem]"
        onCloseAutoFocus={(event) => {
          const trigger = document.getElementById(id);
          if (trigger) {
            event.preventDefault();
            trigger.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription id={`${id}-description`}>
            {description ?? pt('filters.applyDescription')}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled) onApply();
          }}
        >
          <div className="min-h-0 space-y-4 overflow-auto p-1">{children}</div>
          <DialogFooter className="shrink-0">
            <Button type="button" variant="tertiary" className="mr-auto" onClick={onReset}>
              {pt('filters.resetDraft')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {pt('tours.filters.cancel')}
            </Button>
            <Button type="submit" disabled={disabled}>
              {pt('filters.apply')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export type WasteFilterChip = {
  readonly id: string;
  readonly label: string;
  readonly clear: () => void;
};

export const WasteListFilterChips = ({
  chips,
  onReset,
}: {
  readonly chips: readonly WasteFilterChip[];
  readonly onReset: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  if (!chips.length) return null;
  return (
    <>
      {chips.map(({ id, label, clear }) => (
        <Button
          key={id}
          type="button"
          size="sm"
          variant="secondary"
          onClick={clear}
          aria-label={pt('filters.removeCriterion', { value: label })}
        >
          {label} <span aria-hidden="true">×</span>
        </Button>
      ))}
      <Button type="button" size="sm" variant="tertiary" onClick={onReset}>
        {pt('filters.reset')}
      </Button>
    </>
  );
};

export const WasteListSearch = ({
  label,
  value,
  onCommit,
}: {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex min-w-52 flex-col gap-1 text-sm">
      {label}
      <Input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => {
          if (draft.trim() !== value) onCommit(draft.trim());
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
    </label>
  );
};
