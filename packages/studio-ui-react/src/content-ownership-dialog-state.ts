import type { IamContentOwnershipTarget } from '@sva/core';
import * as React from 'react';

import type {
  ContentOwnershipPanelLabels,
  ContentOwnershipTargetLoader,
} from './content-ownership-types.js';

export type ContentOwnershipDialogState = Readonly<{
  search: string;
  setSearch: (value: string) => void;
  targets: readonly IamContentOwnershipTarget[];
  hasMoreTargets: boolean;
  selected: IamContentOwnershipTarget | null;
  selectTarget: (target: IamContentOwnershipTarget) => void;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  loading: boolean;
  pending: boolean;
  error: string | null;
  refreshTargets: () => Promise<void>;
  submitTransfer: () => Promise<boolean>;
}>;

const useTransferSubmission = (input: {
  selected: IamContentOwnershipTarget | null;
  confirmed: boolean;
  labels: ContentOwnershipPanelLabels;
  onTransfer: (target: IamContentOwnershipTarget) => Promise<void>;
  resolveTransferError?: (error: unknown) => string;
  setError: (error: string | null) => void;
}) => {
  const [pending, setPending] = React.useState(false);
  const submitTransfer = async (): Promise<boolean> => {
    if (!input.selected || !input.confirmed) return false;
    setPending(true);
    input.setError(null);
    try {
      await input.onTransfer(input.selected);
      return true;
    } catch (error) {
      input.setError(input.resolveTransferError?.(error) ?? input.labels.transferError);
      return false;
    } finally {
      setPending(false);
    }
  };
  return { pending, submitTransfer };
};

const useRefreshWhenOpen = (open: boolean, refreshTargets: () => Promise<void>): void => {
  React.useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => void refreshTargets(), 250);
    return () => window.clearTimeout(timeout);
  }, [open, refreshTargets]);
};

const resetTargetSelection = (
  setSelected: (target: IamContentOwnershipTarget | null) => void,
  setConfirmed: (confirmed: boolean) => void
): void => {
  setSelected(null);
  setConfirmed(false);
};

export const useContentOwnershipDialogState = (input: {
  open: boolean;
  pageSize: number;
  labels: ContentOwnershipPanelLabels;
  loadTargets: ContentOwnershipTargetLoader;
  onTransfer: (target: IamContentOwnershipTarget) => Promise<void>;
  resolveTransferError?: (error: unknown) => string;
}): ContentOwnershipDialogState => {
  const [search, setSearch] = React.useState('');
  const [targets, setTargets] = React.useState<readonly IamContentOwnershipTarget[]>([]);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<IamContentOwnershipTarget | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const latestRequest = React.useRef(0);
  const refreshTargets = React.useCallback(async () => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    setLoading(true);
    resetTargetSelection(setSelected, setConfirmed);
    setError(null);
    try {
      const query = search.trim();
      const [accounts, organizations] = await Promise.all(
        (['account', 'organization'] as const).map((type) =>
          input.loadTargets({
            type,
            page: 1,
            pageSize: input.pageSize,
            ...(query ? { search: query } : {}),
          })
        )
      );
      if (latestRequest.current !== requestId) return;
      setTargets([...accounts.items, ...organizations.items]);
      setTotal(accounts.total + organizations.total);
    } catch {
      if (latestRequest.current !== requestId) return;
      setTargets([]);
      setTotal(0);
      setError(input.labels.loadError);
    } finally {
      if (latestRequest.current === requestId) setLoading(false);
    }
  }, [input.labels.loadError, input.loadTargets, input.pageSize, search]);
  useRefreshWhenOpen(input.open, refreshTargets);
  const submission = useTransferSubmission({
    selected,
    confirmed,
    labels: input.labels,
    onTransfer: input.onTransfer,
    ...(input.resolveTransferError ? { resolveTransferError: input.resolveTransferError } : {}),
    setError,
  });
  return {
    search,
    setSearch,
    targets,
    hasMoreTargets: total > targets.length,
    selected,
    selectTarget: (target) => {
      setSelected(target);
      setConfirmed(false);
    },
    confirmed,
    setConfirmed,
    loading,
    pending: submission.pending,
    error,
    refreshTargets,
    submitTransfer: submission.submitTransfer,
  };
};
