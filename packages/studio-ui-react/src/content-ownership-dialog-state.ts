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
  submitTransfer: () => Promise<boolean>;
}>;

type ContentOwnershipDialogStateInput = Readonly<{
  open: boolean;
  pageSize: number;
  labels: ContentOwnershipPanelLabels;
  loadTargets: ContentOwnershipTargetLoader;
  onTransfer: (target: IamContentOwnershipTarget) => Promise<void>;
  resolveTransferError?: (error: unknown) => string;
}>;

const MAX_EMPTY_TARGET_PAGES = 5;

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

const useRefreshWhenOpen = (
  open: boolean,
  search: string,
  loadTargets: (search: string) => Promise<void>
): void => {
  React.useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => void loadTargets(search), 250);
    return () => window.clearTimeout(timeout);
  }, [loadTargets, open, search]);
};

const resetTargetSelection = (
  setSelected: (target: IamContentOwnershipTarget | null) => void,
  setConfirmed: (confirmed: boolean) => void
): void => {
  setSelected(null);
  setConfirmed(false);
};

const loadFirstAvailableTargetPage = async (input: {
  readonly loadTargets: ContentOwnershipTargetLoader;
  readonly pageSize: number;
  readonly search?: string;
  readonly type: 'account' | 'organization';
}) => {
  let page = 1;
  let result = await input.loadTargets({
    type: input.type,
    page,
    pageSize: input.pageSize,
    ...(input.search ? { search: input.search } : {}),
  });
  while (
    result.items.length === 0 &&
    page < MAX_EMPTY_TARGET_PAGES &&
    page * input.pageSize < result.total
  ) {
    page += 1;
    result = await input.loadTargets({
      type: input.type,
      page,
      pageSize: input.pageSize,
      ...(input.search ? { search: input.search } : {}),
    });
  }
  return result;
};

export const useContentOwnershipDialogState = (
  input: ContentOwnershipDialogStateInput
): ContentOwnershipDialogState => {
  const [search, setSearch] = React.useState('');
  const [targets, setTargets] = React.useState<readonly IamContentOwnershipTarget[]>([]);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<IamContentOwnershipTarget | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const latestRequest = React.useRef(0);
  const loadTargets = React.useCallback(
    async (searchValue: string) => {
      const requestId = latestRequest.current + 1;
      latestRequest.current = requestId;
      setLoading(true);
      resetTargetSelection(setSelected, setConfirmed);
      setError(null);
      try {
        const query = searchValue.trim();
        const results = await Promise.allSettled(
          (['account', 'organization'] as const).map((type) =>
            loadFirstAvailableTargetPage({
              loadTargets: input.loadTargets,
              type,
              pageSize: input.pageSize,
              ...(query ? { search: query } : {}),
            })
          )
        );
        if (latestRequest.current !== requestId) return;
        const successfulResults = results.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : []
        );
        setTargets(successfulResults.flatMap((result) => result.items));
        setTotal(successfulResults.reduce((sum, result) => sum + result.total, 0));
        setError(
          results.some((result) => result.status === 'rejected') ? input.labels.loadError : null
        );
      } catch {
        if (latestRequest.current !== requestId) return;
        setTargets([]);
        setTotal(0);
        setError(input.labels.loadError);
      } finally {
        if (latestRequest.current === requestId) setLoading(false);
      }
    },
    [input.labels.loadError, input.loadTargets, input.pageSize]
  );
  useRefreshWhenOpen(input.open, search, loadTargets);
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
    submitTransfer: submission.submitTransfer,
  };
};
