import type { IamContentOwnershipTarget } from '@sva/core';
import {
  Button,
  ContentOwnershipDialog,
  useContentOwnershipDialogState,
} from '@sva/studio-ui-react';
import React from 'react';

import { t } from '../../i18n';
import { ownershipPanelLabels } from '../../routing/mainserver-resource-principal';
import {
  loadBatchOwnershipTargets,
  type TransferJob,
  type TransferSelectionItem,
} from './-content-list-transfer';
import type { useContentListTransfer } from './-content-list-transfer-state';

type TransferController = ReturnType<typeof useContentListTransfer>;

const BatchTransferDialog = ({
  items,
  onConfirm,
  onCancel,
}: Readonly<{
  items: readonly TransferSelectionItem[];
  onConfirm: (job: TransferJob) => Promise<void>;
  onCancel: () => void;
}>) => {
  const binding = React.useRef<string | undefined>(undefined);
  const started = React.useRef(false);
  const labels = {
    ...ownershipPanelLabels(),
    dialogTitle: t('content.batch.title'),
    dialogDescription: t('content.batch.confirm', { count: items.length }),
  };
  const loadTargets = React.useCallback(
    (query: Parameters<typeof loadBatchOwnershipTargets>[1]) =>
      loadBatchOwnershipTargets(items, query, (value) => {
        binding.current ??= value;
      }),
    [items]
  );
  const state = useContentOwnershipDialogState({
    open: true,
    pageSize: 10,
    labels,
    loadTargets,
    resolveTransferError: () => t('content.batch.storageError'),
    onTransfer: async (target: IamContentOwnershipTarget) => {
      if (started.current) return;
      if (!binding.current) throw new Error('content_transfer_context_binding_missing');
      started.current = true;
      try {
        await onConfirm({
          binding: binding.current,
          target: target.principal,
          operations: items.map((item) => ({
            item,
            status: 'queued',
            operationId: crypto.randomUUID(),
          })),
        });
      } catch (error) {
        started.current = false;
        throw error;
      }
    },
  });
  return (
    <ContentOwnershipDialog
      labels={labels}
      open
      setOpen={onCancel}
      state={state}
      onSuccess={onCancel}
    />
  );
};

export const ContentListTransferActions = ({
  transfer,
  enabled,
  canSelectAll,
}: Readonly<{
  transfer: TransferController;
  enabled: boolean;
  canSelectAll: boolean;
}>) => {
  if (transfer.job.job || !enabled || !transfer.job.available) return null;
  if (!transfer.active) {
    return (
      <Button variant="secondary" onClick={transfer.start}>
        {t('content.batch.start')}
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p role="status" className="text-sm">
        {t('content.batch.selected', { count: transfer.count })}
      </p>
      <Button
        variant="secondary"
        disabled={!canSelectAll || transfer.loadingAll}
        aria-busy={transfer.loadingAll}
        onClick={() => void transfer.selectAll()}
      >
        {t('content.batch.selectAll')}
      </Button>
      <Button
        variant="secondary"
        disabled={!transfer.count || transfer.loadingAll}
        onClick={transfer.clear}
      >
        {t('content.batch.clear')}
      </Button>
      <Button onClick={transfer.review} disabled={!transfer.count || transfer.loadingAll}>
        {t('content.batch.review')}
      </Button>
      <Button variant="tertiary" disabled={transfer.loadingAll} onClick={transfer.stop}>
        {t('content.actions.cancel')}
      </Button>
      {!canSelectAll ? (
        <p className="text-sm text-muted-foreground">{t('content.batch.partial')}</p>
      ) : null}
      {transfer.selectionError ? (
        <p role="alert" className="text-sm text-destructive">
          {t('content.batch.selectionError')}
        </p>
      ) : null}
    </div>
  );
};

export const ContentListTransferResult = ({
  transfer,
  enabled,
}: Readonly<{ transfer: TransferController; enabled: boolean }>) => {
  const { job, busy, storageError, run, discard } = transfer.job;
  if (!job && enabled && transfer.draft)
    return (
      <BatchTransferDialog
        items={transfer.draft}
        onCancel={transfer.closeDraft}
        onConfirm={async (next) => {
          await run(next, true);
          transfer.stop();
          transfer.closeDraft();
        }}
      />
    );
  if (!job) return null;

  const hasQueued = job.operations.some((operation) => operation.status === 'queued');
  const hasUnclear = job.operations.some((operation) => operation.status === 'reconciling');
  const runSaved = (executeQueued: boolean) => void run(job, executeQueued).catch(() => undefined);
  return (
    <section
      className="space-y-3 rounded-lg border border-border p-4"
      aria-label={t('content.batch.result')}
      aria-busy={busy}
    >
      <h2 className="font-medium">{t('content.batch.result')}</h2>
      {busy ? <p role="status">{t('content.ownership.transferring')}</p> : null}
      {storageError ? <p role="alert">{t('content.batch.storageError')}</p> : null}
      <ul
        tabIndex={0}
        aria-label={t('content.batch.result')}
        className="max-h-64 space-y-1 overflow-y-auto text-sm"
      >
        {job.operations.map(({ item, operationId, status }) => (
          <li key={operationId} className="flex flex-wrap justify-between gap-x-3">
            <span>{item.title}</span>
            <span className="text-muted-foreground">{t(`content.batch.${status}`)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {hasQueued && enabled ? (
          <Button disabled={busy} onClick={() => runSaved(true)}>
            {t('content.batch.continue')}
          </Button>
        ) : null}
        {hasUnclear ? (
          <Button variant="secondary" disabled={busy} onClick={() => runSaved(false)}>
            {t('content.batch.check')}
          </Button>
        ) : null}
        <Button variant="tertiary" disabled={busy} onClick={discard}>
          {t('content.batch.finish')}
        </Button>
      </div>
    </section>
  );
};
