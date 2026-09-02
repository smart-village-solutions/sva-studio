import type { IamContentOwnershipTarget } from '@sva/core';
import { Building2, Check, ChevronsUpDown, Search, UserRound } from 'lucide-react';
import * as React from 'react';

import { Button } from './button.js';
import { Input } from './input.js';
import type { ContentOwnershipPanelLabels } from './content-ownership-types.js';
import { cn } from './utils.js';

const targetKey = (target: IamContentOwnershipTarget) =>
  `${target.principal.type}:${target.principal.id}`;

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
}: Readonly<{
  disabled: boolean;
  hasMoreTargets: boolean;
  labels: ContentOwnershipPanelLabels;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (target: IamContentOwnershipTarget) => void;
  search: string;
  selected: IamContentOwnershipTarget | null;
  targets: readonly IamContentOwnershipTarget[];
}>) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listboxId = `${id}-options`;
  const labelId = `${id}-label`;

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
  const groups = (['account', 'organization'] as const).map((type) => ({
    type,
    items: targets.filter((target) => target.principal.type === type),
  }));

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
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className={cn('flex min-w-0 items-center gap-2', !selected && 'text-muted-foreground')}
        >
          {selected?.principal.type === 'organization' ? (
            <Building2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          ) : selected ? (
            <UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />
          ) : null}
          <span className="truncate">{selected?.displayName ?? labels.targetPlaceholder}</span>
          {selected ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {selected.principal.type === 'organization' ? labels.organization : labels.account}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>
      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-lg border border-border bg-popover shadow-shell">
          <div className="relative border-b border-border p-2">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={inputRef}
              value={search}
              className="pl-9"
              aria-label={labels.search}
              placeholder={labels.search}
              onChange={(event) => onSearchChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setOpen(false);
                  triggerRef.current?.focus();
                }
              }}
            />
          </div>
          <div id={listboxId} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
            {loading ? (
              <div role="option" aria-disabled="true">
                <p className="px-3 py-4 text-sm text-muted-foreground" role="status">
                  {labels.loading}
                </p>
              </div>
            ) : targets.length === 0 ? (
              <p
                role="option"
                aria-disabled="true"
                className="px-3 py-4 text-sm text-muted-foreground"
              >
                {labels.noTargets}
              </p>
            ) : (
              groups.map((group) =>
                group.items.length > 0 ? (
                  <div
                    key={group.type}
                    role="group"
                    aria-label={group.type === 'account' ? labels.account : labels.organization}
                  >
                    <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.type === 'account' ? labels.account : labels.organization}
                    </p>
                    {group.items.map((target) => {
                      const isSelected = selected
                        ? targetKey(selected) === targetKey(target)
                        : false;
                      const Icon = target.principal.type === 'organization' ? Building2 : UserRound;
                      return (
                        <button
                          key={targetKey(target)}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={cn(
                            'flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isSelected && 'bg-muted'
                          )}
                          onClick={() => selectTarget(target)}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Icon aria-hidden="true" className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{target.displayName}</span>
                            {target.readiness === 'verification_required' ? (
                              <span className="block text-xs text-muted-foreground">
                                {labels.verificationRequired}
                              </span>
                            ) : null}
                          </span>
                          {isSelected ? (
                            <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null
              )
            )}
            {!loading && hasMoreTargets ? (
              <p
                role="option"
                aria-disabled="true"
                className="px-3 py-2 text-xs text-muted-foreground"
              >
                {labels.refineSearch}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
