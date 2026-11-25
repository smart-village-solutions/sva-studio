import type { IamContentOwnerPrincipal, IamContentOwnershipTarget } from '@sva/core';
import {
  createMainserverMutationHeaders,
  createMainserverReadHeaders,
  MainserverApiError,
  readMainserverMutationFailureOutcome,
  requestMainserverJson,
  type MainserverActingPrincipalType,
} from '@sva/plugin-sdk';
import type { MainserverPrincipalControlModel } from '@sva/studio-ui-react';

import { resolveStandaloneMainserverPrincipal } from '../../lib/content-status-mutation';
import type { ContentSelectionItem } from '../../lib/iam-api-content-types';

const supportedTypes = new Set([
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
  'generic-items.generic-item',
  'faq.faq',
  'cockpit-cards.cockpit-card',
  'projects.project',
]);

export type TransferSelectionItem = ContentSelectionItem & {
  readonly principal: MainserverActingPrincipalType;
};

export const transferCandidate = (
  item: ContentSelectionItem,
  control: MainserverPrincipalControlModel | undefined
): TransferSelectionItem | undefined => {
  const principal = resolveStandaloneMainserverPrincipal(item, control);
  if (!principal || !supportedTypes.has(item.contentType)) return undefined;
  const { id, contentType, title, historyRef } = item;
  return { id, contentType, title, historyRef, principal };
};

export const transferRowId = (item: ContentSelectionItem): string =>
  `${item.contentType}:${item.id}`;

export const transferSelectionKey = (item: TransferSelectionItem): string =>
  item.historyRef?.startsWith('mainserver:generic-items:') ? item.historyRef : transferRowId(item);

export const selectTransferCandidate = (
  selection: Map<string, TransferSelectionItem>,
  candidate: TransferSelectionItem
): void => {
  const key = transferSelectionKey(candidate);
  const existing = selection.get(key);
  if (!existing || existing.contentType === 'generic-items.generic-item') {
    selection.set(key, candidate);
  }
};

const path = '/api/v1/mainserver/content-ownership';
const ownershipUrl = ({ contentType, id }: TransferSelectionItem): string =>
  `${path}/${encodeURIComponent(contentType)}/${encodeURIComponent(id)}`;

export const loadBatchOwnershipTargets = async (
  items: readonly TransferSelectionItem[],
  query: Readonly<{
    type: 'account' | 'organization';
    page: number;
    pageSize: number;
    search?: string;
  }>,
  onBinding: (binding: string) => void
) => {
  const params = new URLSearchParams({
    selection: 'batch',
    type: query.type,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.search) params.set('q', query.search);

  for (const item of items) {
    try {
      const response = await requestMainserverJson<{
        data: readonly IamContentOwnershipTarget[];
        pagination: { total: number };
      }>({
        url: `${ownershipUrl(item)}/targets?${params}`,
        init: { headers: createMainserverReadHeaders(item.principal) },
        onResponse: (meta) => {
          if (meta.ok && meta.contextBinding) onBinding(meta.contextBinding);
        },
      });
      return { items: response.data, total: response.pagination.total };
    } catch (error) {
      if (
        !(error instanceof MainserverApiError) ||
        ![
          'not_found',
          'forbidden',
          'content_transfer_permission_missing',
          'content_transfer_source_unresolved',
          'content_transfer_source_changed',
          'acting_principal_not_allowed',
        ].includes(error.code)
      )
        throw error;
    }
  }
  throw new MainserverApiError('content_transfer_permission_missing');
};

export type TransferStatus = 'queued' | 'succeeded' | 'reconciling' | 'rejected';
export type TransferOperation = Readonly<{
  item: TransferSelectionItem;
  operationId: string;
  status: TransferStatus;
}>;
export type TransferJob = Readonly<{
  target: IamContentOwnerPrincipal;
  binding: string;
  operations: readonly TransferOperation[];
}>;

export const readTransferStatus = async (
  operation: TransferOperation,
  signal: AbortSignal
): Promise<TransferStatus> => {
  try {
    const { data } = await requestMainserverJson<{
      data: { providerOutcome: string; reconciliationStatus: string };
    }>({
      url: `${path}/operations/${encodeURIComponent(operation.operationId)}`,
      init: { headers: createMainserverReadHeaders(operation.item.principal), signal },
    });
    if (data.providerOutcome === 'failed' && data.reconciliationStatus === 'complete')
      return 'rejected';
    if (data.providerOutcome === 'succeeded' && data.reconciliationStatus === 'complete')
      return 'succeeded';
  } catch (error) {
    // Resume explicitly with the same ID. The server checks that ID under the content lock.
    if (error instanceof MainserverApiError && error.code === 'operation_not_found')
      return 'queued';
  }
  return 'reconciling';
};

export const executeTransferOperation = async (
  job: TransferJob,
  operation: TransferOperation,
  signal: AbortSignal
): Promise<TransferStatus> => {
  try {
    await requestMainserverJson({
      url: `${ownershipUrl(operation.item)}/transfer`,
      init: {
        method: 'POST',
        headers: createMainserverMutationHeaders(
          operation.item.principal,
          { 'X-SVA-Context-Binding': job.binding },
          operation.operationId
        ),
        body: JSON.stringify({ targetPrincipal: job.target }),
        signal,
      },
    });
  } catch (error) {
    if (readMainserverMutationFailureOutcome(error) === 'not_applied') return 'rejected';
    if (
      error instanceof MainserverApiError &&
      [
        'forbidden',
        'unauthorized',
        'not_found',
        'acting_principal_not_allowed',
        'stale_mainserver_context',
        'csrf_validation_failed',
        'content_transfer_permission_missing',
        'content_transfer_type_unsupported',
        'content_transfer_source_changed',
      ].includes(error.code)
    )
      return 'rejected';
  }
  return readTransferStatus(operation, signal);
};

export const runTransferJob = async (
  initial: TransferJob,
  executeQueued: boolean,
  signal: AbortSignal,
  commit: (job: TransferJob) => void
): Promise<void> => {
  let job = initial;
  const saveStatus = (index: number, status: TransferStatus) => {
    job = {
      ...job,
      operations: job.operations.map((operation, currentIndex) =>
        index === currentIndex ? { ...operation, status } : operation
      ),
    };
    commit(job);
  };
  for (const [index, operation] of initial.operations.entries()) {
    if (signal.aborted) break;
    if (operation.status === 'queued' && executeQueued) {
      // Persist the uncertain state before sending, so reload checks the journal first.
      saveStatus(index, 'reconciling');
      const status = await executeTransferOperation(job, operation, signal);
      if (!signal.aborted) saveStatus(index, status);
    } else if (operation.status === 'reconciling') {
      const status = await readTransferStatus(operation, signal);
      if (!signal.aborted && status !== operation.status) saveStatus(index, status);
    }
  }
};
