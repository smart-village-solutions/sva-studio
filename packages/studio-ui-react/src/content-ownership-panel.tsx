import * as React from 'react';

import { Button } from './button.js';
import { ContentOwnershipDialog } from './content-ownership-dialog.js';
import { useContentOwnershipDialogState } from './content-ownership-dialog-state.js';
import { principalTypeLabel, type ContentOwnershipPanelProps } from './content-ownership-types.js';

export type {
  ContentOwnershipPanelLabels,
  ContentOwnershipPanelOwner,
  ContentOwnershipPanelProps,
} from './content-ownership-types.js';

export function ContentOwnershipPanel({
  currentOwner,
  supported,
  canTransfer,
  labels,
  loadTargets,
  onTransfer,
  resolveTransferError,
  pageSize = 10,
}: ContentOwnershipPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const dialogState = useContentOwnershipDialogState({
    open,
    pageSize,
    labels,
    loadTargets,
    onTransfer,
    ...(resolveTransferError ? { resolveTransferError } : {}),
  });
  const currentType = principalTypeLabel(
    currentOwner.principal?.type ?? currentOwner.principalType,
    labels
  );

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
          {currentOwner.principal || currentOwner.principalType ? (
            <span className="text-muted-foreground"> · {currentType}</span>
          ) : null}
        </p>
        {currentOwner.principalResolution === 'unresolved' ? (
          <p className="text-sm text-muted-foreground">{labels.ownerUnresolved}</p>
        ) : currentOwner.principalResolution === 'failed' ? (
          <p className="text-sm text-muted-foreground">{labels.ownerResolutionFailed}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">{labels.saveKeepsOwner}</p>
      </div>
      {success ? (
        <p className="text-sm text-primary" role="status">
          {labels.success}
        </p>
      ) : null}
      {!supported ? (
        <p className="text-sm text-muted-foreground">{labels.transferUnavailable}</p>
      ) : !canTransfer ? (
        <p className="text-sm text-muted-foreground">{labels.transferForbidden}</p>
      ) : (
        <Button
          type="button"
          onClick={() => {
            setSuccess(false);
            setOpen(true);
          }}
        >
          {labels.transferAction}
        </Button>
      )}
      <ContentOwnershipDialog
        currentOwner={currentOwner}
        labels={labels}
        open={open}
        setOpen={setOpen}
        state={dialogState}
        onSuccess={() => {
          setSuccess(true);
          setOpen(false);
        }}
      />
    </section>
  );
}
