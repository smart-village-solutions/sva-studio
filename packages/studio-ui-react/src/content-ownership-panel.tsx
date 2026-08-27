import type { IamContentOwnerPrincipal, IamContentOwnershipTarget } from '@sva/core';
import * as React from 'react';

import { Button } from './button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog.js';
import { Input } from './input.js';
import { Select } from './select.js';

export type ContentOwnershipPanelOwner = Readonly<{
  principal?: IamContentOwnerPrincipal;
  displayName: string;
}>;

export type ContentOwnershipPanelLabels = Readonly<{
  title: string;
  currentOwner: string;
  account: string;
  organization: string;
  saveKeepsOwner: string;
  transferUnavailable: string;
  transferForbidden: string;
  transferAction: string;
  dialogTitle: string;
  dialogDescription: string;
  targetType: string;
  search: string;
  searchAction: string;
  loading: string;
  loadError: string;
  noTargets: string;
  previousPage: string;
  nextPage: string;
  confirmation: string;
  accessWarning: string;
  authorEffect: string;
  cancel: string;
  confirm: string;
  transferring: string;
  transferError: string;
}>;

export type ContentOwnershipPanelProps = Readonly<{
  currentOwner: ContentOwnershipPanelOwner;
  supported: boolean;
  canTransfer: boolean;
  labels: ContentOwnershipPanelLabels;
  loadTargets: (input: {
    readonly type: 'account' | 'organization';
    readonly page: number;
    readonly pageSize: number;
    readonly search?: string;
  }) => Promise<Readonly<{ items: readonly IamContentOwnershipTarget[]; total: number }>>;
  onTransfer: (target: IamContentOwnershipTarget) => Promise<void>;
  pageSize?: number;
}>;

const principalTypeLabel = (
  type: IamContentOwnerPrincipal['type'] | undefined,
  labels: ContentOwnershipPanelLabels
) => (type === 'organization' ? labels.organization : labels.account);

export function ContentOwnershipPanel({
  currentOwner,
  supported,
  canTransfer,
  labels,
  loadTargets,
  onTransfer,
  pageSize = 10,
}: ContentOwnershipPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [targetType, setTargetType] = React.useState<'account' | 'organization'>('account');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [targets, setTargets] = React.useState<readonly IamContentOwnershipTarget[]>([]);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<IamContentOwnershipTarget | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<'load' | 'transfer' | null>(null);

  const refreshTargets = React.useCallback(async () => {
    setLoading(true);
    setSelected(null);
    setConfirmed(false);
    setError(null);
    try {
      const result = await loadTargets({
        type: targetType,
        page,
        pageSize,
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      setTargets(result.items);
      setTotal(result.total);
    } catch {
      setTargets([]);
      setTotal(0);
      setError('load');
    } finally {
      setLoading(false);
    }
  }, [loadTargets, page, pageSize, search, targetType]);

  React.useEffect(() => {
    if (open) {
      void refreshTargets();
    }
  }, [open, refreshTargets]);

  const submitTransfer = async () => {
    if (!selected || !confirmed) return;
    setPending(true);
    setError(null);
    try {
      await onTransfer(selected);
      setOpen(false);
    } catch {
      setError('transfer');
    } finally {
      setPending(false);
    }
  };

  const currentType = principalTypeLabel(currentOwner.principal?.type, labels);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section
      className="space-y-3 rounded-xl border border-border/70 bg-card p-4"
      aria-labelledby="content-ownership-title"
    >
      <div className="space-y-1">
        <h2 id="content-ownership-title" className="text-sm font-semibold">
          {labels.title}
        </h2>
        <p className="text-sm">
          <span className="text-muted-foreground">{labels.currentOwner}: </span>
          <strong>{currentOwner.displayName}</strong>
          {currentOwner.principal ? (
            <span className="text-muted-foreground"> · {currentType}</span>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground">{labels.saveKeepsOwner}</p>
      </div>

      {!supported ? (
        <p className="text-sm text-muted-foreground">{labels.transferUnavailable}</p>
      ) : !canTransfer ? (
        <p className="text-sm text-muted-foreground">{labels.transferForbidden}</p>
      ) : (
        <Button type="button" className="min-h-11" onClick={() => setOpen(true)}>
          {labels.transferAction}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{labels.dialogTitle}</DialogTitle>
            <DialogDescription>{labels.dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="space-y-1 text-sm">
              <span>{labels.targetType}</span>
              <Select
                value={targetType}
                onChange={(event) => {
                  setTargetType(event.target.value as 'account' | 'organization');
                  setPage(1);
                }}
                disabled={pending}
              >
                <option value="account">{labels.account}</option>
                <option value="organization">{labels.organization}</option>
              </Select>
            </label>

            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                void refreshTargets();
              }}
            >
              <Input
                aria-label={labels.search}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={pending}
              />
              <Button
                type="submit"
                variant="secondary"
                className="min-h-11"
                disabled={loading || pending}
              >
                {labels.searchAction}
              </Button>
            </form>

            <fieldset className="space-y-2" disabled={loading || pending}>
              <legend className="sr-only">{labels.dialogTitle}</legend>
              {loading ? <p aria-live="polite">{labels.loading}</p> : null}
              {!loading && targets.length === 0 ? <p>{labels.noTargets}</p> : null}
              {targets.map((target) => {
                const id = `ownership-target-${target.principal.type}-${target.principal.id}`;
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3"
                  >
                    <input
                      id={id}
                      type="radio"
                      name="ownership-target"
                      checked={
                        selected?.principal.id === target.principal.id &&
                        selected.principal.type === target.principal.type
                      }
                      onChange={() => {
                        setSelected(target);
                        setConfirmed(false);
                      }}
                    />
                    <span>
                      <span className="block font-medium">{target.displayName}</span>
                      <span className="block text-sm text-muted-foreground">
                        {principalTypeLabel(target.principal.type, labels)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error === 'load' ? labels.loadError : labels.transferError}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                disabled={page <= 1 || loading || pending}
                onClick={() => setPage((value) => value - 1)}
              >
                {labels.previousPage}
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                disabled={page >= totalPages || loading || pending}
                onClick={() => setPage((value) => value + 1)}
              >
                {labels.nextPage}
              </Button>
            </div>

            {selected ? (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="font-medium">
                  {currentOwner.displayName} → {selected.displayName}
                </p>
                <p className="text-sm text-muted-foreground">{labels.authorEffect}</p>
                <p className="text-sm text-muted-foreground">{labels.accessWarning}</p>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span>{labels.confirmation}</span>
                </label>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {labels.cancel}
            </Button>
            <Button
              type="button"
              disabled={!selected || !confirmed || pending}
              onClick={() => void submitTransfer()}
            >
              {pending ? labels.transferring : labels.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
