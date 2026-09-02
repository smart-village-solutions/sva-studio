import type { IamContentOwnershipTarget } from '@sva/core';
import { Building2, Check, Search, UserRound } from 'lucide-react';
import { useRef, type RefObject } from 'react';

import { Input } from './input.js';
import {
  focusBoundaryOption,
  handleListboxKeyDown,
} from './content-ownership-target-select.keyboard.js';
import type { ContentOwnershipPanelLabels } from './content-ownership-types.js';
import { cn } from './utils.js';

const targetKey = (target: IamContentOwnershipTarget) =>
  `${target.principal.type}:${target.principal.id}`;

function TargetIcon({ type }: Readonly<{ type: IamContentOwnershipTarget['principal']['type'] }>) {
  const Icon = type === 'organization' ? Building2 : UserRound;
  return <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />;
}

export function TargetSelectValue({
  id,
  labels,
  selected,
}: Readonly<{
  id: string;
  labels: ContentOwnershipPanelLabels;
  selected: IamContentOwnershipTarget | null;
}>) {
  if (!selected) {
    return (
      <span id={id} className="min-w-0 flex-1 truncate text-muted-foreground">
        {labels.targetPlaceholder}
      </span>
    );
  }

  return (
    <span id={id} className="flex min-w-0 flex-1 items-center gap-2">
      <TargetIcon type={selected.principal.type} />
      <span className="truncate">{selected.displayName}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {selected.principal.type === 'organization' ? labels.organization : labels.account}
      </span>
    </span>
  );
}

function TargetOption({
  labels,
  onSelect,
  selected,
  target,
}: Readonly<{
  labels: ContentOwnershipPanelLabels;
  onSelect: (target: IamContentOwnershipTarget) => void;
  selected: IamContentOwnershipTarget | null;
  target: IamContentOwnershipTarget;
}>) {
  const isSelected = selected ? targetKey(selected) === targetKey(target) : false;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected && 'bg-muted'
      )}
      onClick={() => onSelect(target)}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <TargetIcon type={target.principal.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{target.displayName}</span>
        {target.readiness === 'verification_required' ? (
          <span className="block text-xs text-muted-foreground">{labels.verificationRequired}</span>
        ) : null}
      </span>
      {isSelected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
    </button>
  );
}

function TargetGroup({
  labels,
  onSelect,
  selected,
  targets,
  type,
}: Readonly<{
  labels: ContentOwnershipPanelLabels;
  onSelect: (target: IamContentOwnershipTarget) => void;
  selected: IamContentOwnershipTarget | null;
  targets: readonly IamContentOwnershipTarget[];
  type: IamContentOwnershipTarget['principal']['type'];
}>) {
  const items = targets.filter((target) => target.principal.type === type);
  if (items.length === 0) return null;
  const groupLabel = type === 'account' ? labels.account : labels.organization;

  return (
    <div role="group" aria-label={groupLabel}>
      <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {groupLabel}
      </p>
      {items.map((target) => (
        <TargetOption
          key={targetKey(target)}
          labels={labels}
          onSelect={onSelect}
          selected={selected}
          target={target}
        />
      ))}
    </div>
  );
}

function TargetResults({
  hasMoreTargets,
  labels,
  loading,
  onSelect,
  selected,
  targets,
}: Readonly<{
  hasMoreTargets: boolean;
  labels: ContentOwnershipPanelLabels;
  loading: boolean;
  onSelect: (target: IamContentOwnershipTarget) => void;
  selected: IamContentOwnershipTarget | null;
  targets: readonly IamContentOwnershipTarget[];
}>) {
  if (loading) {
    return (
      <div role="option" aria-disabled="true">
        <p className="px-3 py-4 text-sm text-muted-foreground" role="status">
          {labels.loading}
        </p>
      </div>
    );
  }

  if (targets.length === 0) {
    return (
      <p role="option" aria-disabled="true" className="px-3 py-4 text-sm text-muted-foreground">
        {labels.noTargets}
      </p>
    );
  }

  return (
    <>
      <TargetGroup
        type="account"
        labels={labels}
        onSelect={onSelect}
        selected={selected}
        targets={targets}
      />
      <TargetGroup
        type="organization"
        labels={labels}
        onSelect={onSelect}
        selected={selected}
        targets={targets}
      />
      {hasMoreTargets ? (
        <p role="option" aria-disabled="true" className="px-3 py-2 text-xs text-muted-foreground">
          {labels.refineSearch}
        </p>
      ) : null}
    </>
  );
}

export function TargetSelectPopover({
  inputRef,
  labels,
  listboxId,
  onClose,
  onSearchChange,
  onSelect,
  search,
  ...resultsProps
}: Readonly<{
  hasMoreTargets: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  labels: ContentOwnershipPanelLabels;
  listboxId: string;
  loading: boolean;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (target: IamContentOwnershipTarget) => void;
  search: string;
  selected: IamContentOwnershipTarget | null;
  targets: readonly IamContentOwnershipTarget[];
}>) {
  const listboxRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      data-content-ownership-target-popover
      className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-lg border border-border bg-popover shadow-shell"
    >
      <div className="relative border-b border-border p-2">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          value={search}
          className="pl-9"
          aria-controls={listboxId}
          aria-label={labels.search}
          placeholder={labels.search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              focusBoundaryOption(listboxRef.current, event.key === 'ArrowUp');
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
        />
      </div>
      <div
        ref={listboxRef}
        id={listboxId}
        role="listbox"
        className="max-h-72 overflow-y-auto p-1.5"
        onKeyDown={(event) => handleListboxKeyDown(event, onClose)}
      >
        <TargetResults labels={labels} onSelect={onSelect} {...resultsProps} />
      </div>
    </div>
  );
}
