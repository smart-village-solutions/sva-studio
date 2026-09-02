import type { IamContentOwnershipTarget } from '@sva/core';
import { ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { Button } from './button.js';
import { TargetSelectPopover, TargetSelectValue } from './content-ownership-target-select.parts.js';
import type { ContentOwnershipPanelLabels } from './content-ownership-types.js';

type TargetSelectProps = Readonly<{
  disabled: boolean;
  hasMoreTargets: boolean;
  labels: ContentOwnershipPanelLabels;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (target: IamContentOwnershipTarget) => void;
  search: string;
  selected: IamContentOwnershipTarget | null;
  targets: readonly IamContentOwnershipTarget[];
}>;

export function ContentOwnershipTargetSelect({
  disabled,
  hasMoreTargets,
  labels,
  loading,
  onSearchChange,
  onSelect,
  search,
  selected,
  targets,
}: TargetSelectProps) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listboxId = `${id}-options`;
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const selectTarget = (target: IamContentOwnershipTarget) => {
    onSelect(target);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <span id={labelId} className="text-sm font-medium">
        {labels.targetOwner}
      </span>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        className="h-11 w-full justify-between gap-3 px-3 font-normal"
        role="combobox"
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${labelId} ${valueId}`}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <TargetSelectValue id={valueId} labels={labels} selected={selected} />
        <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>
      {open ? (
        <TargetSelectPopover
          hasMoreTargets={hasMoreTargets}
          inputRef={inputRef}
          labels={labels}
          listboxId={listboxId}
          loading={loading}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
          onSearchChange={onSearchChange}
          onSelect={selectTarget}
          search={search}
          selected={selected}
          targets={targets}
        />
      ) : null}
    </div>
  );
}
