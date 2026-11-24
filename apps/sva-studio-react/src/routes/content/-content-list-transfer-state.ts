import type { IamContentListQuery } from '@sva/core';
import type { MainserverPrincipalControlModel } from '@sva/studio-ui-react';
import React from 'react';
import { z } from 'zod';

import { useOrganizationContext } from '../../hooks/use-organization-context';
import { listContentSelection } from '../../lib/iam-api-content';
import { asIamError } from '../../lib/iam-http-client';
import { useAuth } from '../../providers/auth-provider';
import {
  runTransferJob,
  selectTransferCandidate,
  transferCandidate,
  transferRowId,
  transferSelectionKey,
  type TransferJob,
  type TransferSelectionItem,
} from './-content-list-transfer';
import type { RegisteredContentRow } from './-content-list-row-actions';

const jobSchema = z.object({
  binding: z.string().regex(/^v1\.[A-Za-z0-9_-]+$/),
  target: z.object({ type: z.enum(['account', 'organization']), id: z.string().min(1) }),
  operations: z
    .array(
      z.object({
        operationId: z.uuid(),
        status: z.enum(['queued', 'succeeded', 'reconciling', 'rejected']),
        item: z.object({
          contentType: z.string(),
          id: z.string(),
          title: z.string(),
          historyRef: z.string(),
          principal: z.enum(['user', 'organization']),
        }),
      })
    )
    .min(1),
});

const readJob = (key: string): TransferJob | null => {
  try {
    const result = jobSchema.safeParse(JSON.parse(window.sessionStorage.getItem(key) ?? 'null'));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

const useTransferJob = (key: string | undefined, refetch: () => Promise<void>) => {
  const [saved, setSaved] = React.useState<Readonly<{ key: string; job: TransferJob | null }>>();
  const [busy, setBusy] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);
  const runRef = React.useRef<AbortController | null>(null);
  const job = saved?.key === key ? saved?.job : null;

  React.useLayoutEffect(() => {
    if (key) setSaved({ key, job: readJob(key) });
    setBusy(false);
    setStorageError(false);
    return () => {
      runRef.current?.abort();
      runRef.current = null;
    };
  }, [key]);

  const run = async (current: TransferJob, executeQueued: boolean): Promise<void> => {
    if (!key || runRef.current) return;
    const controller = new AbortController();
    const commit = (next: TransferJob) => {
      window.sessionStorage.setItem(key, JSON.stringify(next));
      setSaved({ key, job: next });
    };
    try {
      commit(current);
    } catch (error) {
      setStorageError(true);
      throw error;
    }
    runRef.current = controller;
    setBusy(true);
    setStorageError(false);
    try {
      await runTransferJob(current, executeQueued, controller.signal, commit);
    } catch {
      if (!controller.signal.aborted) setStorageError(true);
    } finally {
      if (runRef.current === controller) {
        runRef.current = null;
        setBusy(false);
        if (executeQueued)
          void Promise.resolve()
            .then(refetch)
            .catch(() => undefined);
      }
    }
  };

  return {
    job,
    busy,
    storageError,
    available: Boolean(key),
    run,
    discard: () => {
      if (
        !key ||
        runRef.current ||
        job?.operations.some(({ status }) => status === 'queued' || status === 'reconciling')
      ) return;
      try {
        window.sessionStorage.removeItem(key);
        setSaved({ key, job: null });
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    },
  };
};

export const useContentListTransfer = ({
  query,
  registeredContents,
  principalControl,
  refetch,
  enabled,
}: Readonly<{
  query: IamContentListQuery;
  registeredContents: readonly RegisteredContentRow[];
  principalControl?: MainserverPrincipalControlModel;
  refetch: () => Promise<void>;
  enabled: boolean;
}>) => {
  const { user } = useAuth();
  const organizationContext = useOrganizationContext();
  const key =
    user?.instanceId && organizationContext.context
      ? `studio.content-transfer.v1:${JSON.stringify([user.instanceId, user.id, organizationContext.context.activeOrganizationId])}`
      : undefined;
  const currentRefetch = React.useRef(refetch);
  React.useLayoutEffect(() => {
    currentRefetch.current = refetch;
  }, [refetch]);
  const refetchCurrentList = React.useCallback(() => currentRefetch.current(), []);
  const job = useTransferJob(key, refetchCurrentList);
  const { type, status, categoryId, q, languageCode, poiId, visibleTypes } = query;
  const scope = JSON.stringify([
    key,
    enabled,
    type,
    status,
    categoryId,
    q,
    languageCode,
    poiId,
    visibleTypes,
  ]);
  const selectionRequest = React.useRef(0);
  const reviewButtonRef = React.useRef<HTMLButtonElement>(null);
  const [activeScope, setActiveScope] = React.useState<string>();
  const [selected, setSelected] = React.useState(() => new Map<string, TransferSelectionItem>());
  const [draft, setDraft] = React.useState<readonly TransferSelectionItem[]>();
  const [loadingAll, setLoadingAll] = React.useState(false);
  const [selectionError, setSelectionError] = React.useState(false);
  const active = enabled && activeScope === scope && !job.job;
  // The table rebuilds its row model from data when transfer mode changes row identifiers.
  const tableRows = React.useMemo(
    () => (active ? [...registeredContents] : registeredContents),
    [active, registeredContents]
  );

  React.useLayoutEffect(() => {
    setActiveScope(undefined);
    setSelected(new Map());
    setDraft(undefined);
    setLoadingAll(false);
    setSelectionError(false);
    return () => {
      selectionRequest.current += 1;
    };
  }, [scope]);

  const currentPage = (active ? registeredContents : []).flatMap((row) => {
    const candidate = transferCandidate(row, principalControl);
    return candidate ? [candidate] : [];
  });
  const rowSelection: Record<string, true> = {};
  for (const item of currentPage) {
    if (selected.has(transferSelectionKey(item))) rowSelection[transferRowId(item)] = true;
  }

  const selectAll = async () => {
    if (loadingAll) return;
    const requestId = ++selectionRequest.current;
    setLoadingAll(true);
    setSelectionError(false);
    try {
      const { data } = await listContentSelection(query);
      if (selectionRequest.current !== requestId) return;
      const next = new Map<string, TransferSelectionItem>();
      for (const item of data) {
        const candidate = transferCandidate(item, principalControl);
        if (candidate) selectTransferCandidate(next, candidate);
      }
      setSelected(next);
    } catch (error) {
      if (selectionRequest.current !== requestId) return;
      setSelectionError(true);
      if (asIamError(error).status === 409) await refetchCurrentList().catch(() => undefined);
    } finally {
      if (selectionRequest.current === requestId) setLoadingAll(false);
    }
  };

  return {
    active,
    tableRows,
    job,
    draft,
    loadingAll,
    selectionError,
    selectAll,
    count: selected.size,
    canSelectRow: (row: RegisteredContentRow) =>
      !loadingAll && Boolean(transferCandidate(row, principalControl)),
    start: () => setActiveScope(scope),
    clear: () => setSelected(new Map()),
    stop: () => {
      setSelected(new Map());
      setActiveScope(undefined);
    },
    reviewButtonRef,
    review: () => setDraft([...selected.values()]),
    closeDraft: () => setDraft(undefined),
    selection: {
      state: rowSelection,
      onChange: (changes: Record<string, true>) => {
        const next = new Map(selected);
        for (const item of currentPage) {
          const id = transferRowId(item);
          if (Boolean(changes[id]) === Boolean(rowSelection[id])) continue;
          if (changes[id]) selectTransferCandidate(next, item);
          else next.delete(transferSelectionKey(item));
        }
        setSelected(next);
      },
    },
  };
};
