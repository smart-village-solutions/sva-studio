import { Button } from './button.js';
import type { ContentOwnershipDialogState } from './content-ownership-dialog-state.js';
import { ContentOwnershipTargetSelect } from './content-ownership-target-select.js';
import type {
  ContentOwnershipPanelLabels,
  ContentOwnershipPanelOwner,
} from './content-ownership-types.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog.js';

type DialogPartProps = Readonly<{
  labels: ContentOwnershipPanelLabels;
  state: ContentOwnershipDialogState;
}>;

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
        <ContentOwnershipTargetSelect
          disabled={state.pending}
          hasMoreTargets={state.hasMoreTargets}
          labels={labels}
          loading={state.loading}
          search={state.search}
          selected={state.selected}
          targets={state.targets}
          onSearchChange={state.setSearch}
          onSelect={state.selectTarget}
        />
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
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
