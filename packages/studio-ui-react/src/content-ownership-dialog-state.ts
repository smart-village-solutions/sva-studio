import type { IamContentOwnershipTarget } from '@sva/core';
import * as React from 'react';

import type {
  ContentOwnershipPanelLabels,
  ContentOwnershipTargetLoader,
} from './content-ownership-types.js';

export type ContentOwnershipDialogState = Readonly<{
  targetType: 'account' | 'organization';
  setTargetType: (value: 'account' | 'organization') => void;
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  targets: readonly IamContentOwnershipTarget[];
  selected: IamContentOwnershipTarget | null;
  selectTarget: (target: IamContentOwnershipTarget) => void;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  loading: boolean;
  pending: boolean;
  error: string | null;
  totalPages: number;
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
    if (open) void refreshTargets();
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
  const [targetType, setTargetTypeState] = React.useState<'account' | 'organization'>('account');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
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
      const result = await input.loadTargets({
        type: targetType,
        page,
        pageSize: input.pageSize,
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      if (latestRequest.current !== requestId) return;
      setTargets(result.items);
      setTotal(result.total);
    } catch {
      if (latestRequest.current !== requestId) return;
      setTargets([]);
      setTotal(0);
      setError(input.labels.loadError);
    } finally {
      if (latestRequest.current === requestId) setLoading(false);
    }
  }, [input.labels.loadError, input.loadTargets, input.pageSize, page, search, targetType]);
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
    targetType,
    setTargetType: (value) => {
      setTargetTypeState(value);
      setSearch('');
      setPage(1);
    },
    search,
    setSearch,
    page,
    setPage,
    targets,
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
    totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    refreshTargets,
    submitTransfer: submission.submitTransfer,
  };
};
