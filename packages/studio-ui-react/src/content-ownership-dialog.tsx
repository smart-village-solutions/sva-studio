import { Button } from './button.js';
import type { ContentOwnershipDialogState } from './content-ownership-dialog-state.js';
import type {
  ContentOwnershipPanelLabels,
  ContentOwnershipPanelOwner,
} from './content-ownership-types.js';
import { principalTypeLabel } from './content-ownership-types.js';
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

type DialogPartProps = Readonly<{
  labels: ContentOwnershipPanelLabels;
  state: ContentOwnershipDialogState;
}>;

const TargetFilters = ({ labels, state }: DialogPartProps) => (
  <>
    <label className="space-y-1 text-sm">
      <span>{labels.targetType}</span>
      <Select
        value={state.targetType}
        onChange={(event) => state.setTargetType(event.target.value as 'account' | 'organization')}
        disabled={state.pending}
      >
        <option value="account">{labels.account}</option>
        <option value="organization">{labels.organization}</option>
      </Select>
    </label>
    {state.targetType === 'organization' ? (
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          state.setPage(1);
          void state.refreshTargets();
        }}
      >
        <Input
          aria-label={labels.search}
          value={state.search}
          onChange={(event) => state.setSearch(event.target.value)}
          disabled={state.pending}
        />
        <Button type="submit" variant="secondary" disabled={state.loading || state.pending}>
          {labels.searchAction}
        </Button>
      </form>
    ) : null}
  </>
);

const TargetOptions = ({ labels, state }: DialogPartProps) => (
  <fieldset className="space-y-2" disabled={state.loading || state.pending}>
    <legend className="sr-only">{labels.dialogTitle}</legend>
    {state.loading ? <p aria-live="polite">{labels.loading}</p> : null}
    {!state.loading && state.targets.length === 0 ? <p>{labels.noTargets}</p> : null}
    {state.targets.map((target) => {
      const id = `ownership-target-${target.principal.type}-${target.principal.id}`;
      const selected =
        state.selected?.principal.id === target.principal.id &&
        state.selected.principal.type === target.principal.type;
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
            checked={selected}
            onChange={() => state.selectTarget(target)}
          />
          <span>
            <span className="block font-medium">{target.displayName}</span>
            <span className="block text-sm text-muted-foreground">
              {principalTypeLabel(target.principal.type, labels)}
            </span>
            {target.readiness === 'verification_required' ? (
              <span className="block text-sm text-muted-foreground">
                {labels.verificationRequired}
              </span>
            ) : null}
          </span>
        </label>
      );
    })}
  </fieldset>
);

const TargetPagination = ({ labels, state }: DialogPartProps) => (
  <div className="flex items-center justify-between gap-3">
    <Button
      type="button"
      variant="secondary"
      disabled={state.page <= 1 || state.loading || state.pending}
      onClick={() => state.setPage((value) => value - 1)}
    >
      {labels.previousPage}
    </Button>
    <span className="text-sm text-muted-foreground">{state.page}</span>
    <Button
      type="button"
      variant="secondary"
      disabled={state.page >= state.totalPages || state.loading || state.pending}
      onClick={() => state.setPage((value) => value + 1)}
    >
      {labels.nextPage}
    </Button>
  </div>
);

const TransferConfirmation = ({
  currentOwner,
  labels,
  state,
}: DialogPartProps & Readonly<{ currentOwner: ContentOwnershipPanelOwner }>) =>
  state.selected ? (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="font-medium">
        {currentOwner.displayName} → {state.selected.displayName}
      </p>
      <p className="text-sm text-muted-foreground">{labels.authorEffect}</p>
      <p className="text-sm text-muted-foreground">{labels.accessWarning}</p>
      {state.selected.readiness === 'verification_required' ? (
        <p className="text-sm text-muted-foreground">{labels.verificationRequired}</p>
      ) : null}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={state.confirmed}
          onChange={(event) => state.setConfirmed(event.target.checked)}
        />
        <span>{labels.confirmation}</span>
      </label>
    </div>
  ) : null;

export const ContentOwnershipDialog = ({
  currentOwner,
  labels,
  open,
  setOpen,
  state,
  onSuccess,
}: Readonly<{
  currentOwner: ContentOwnershipPanelOwner;
  labels: ContentOwnershipPanelLabels;
  open: boolean;
  setOpen: (open: boolean) => void;
  state: ContentOwnershipDialogState;
  onSuccess: () => void;
}>) => (
  <Dialog open={open} onOpenChange={(nextOpen) => !state.pending && setOpen(nextOpen)}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{labels.dialogTitle}</DialogTitle>
        <DialogDescription>{labels.dialogDescription}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <TargetFilters labels={labels} state={state} />
        <TargetOptions labels={labels} state={state} />
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        <TargetPagination labels={labels} state={state} />
        <TransferConfirmation currentOwner={currentOwner} labels={labels} state={state} />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="secondary"
          disabled={state.pending}
          onClick={() => setOpen(false)}
        >
          {labels.cancel}
        </Button>
        <Button
          type="button"
          disabled={!state.selected || !state.confirmed || state.pending}
          onClick={() => void state.submitTransfer().then((done) => done && onSuccess())}
        >
          {state.pending ? labels.transferring : labels.confirm}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
