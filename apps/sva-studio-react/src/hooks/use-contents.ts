import React from 'react';
import type { IamContentDetail, IamContentHistoryEntry, IamContentListItem } from '@sva/core';

import {
  asIamError,
  createContent,
  getContent,
  getContentHistory,
  IamHttpError,
  listContents,
  updateContent,
  type CreateContentPayload,
  type UpdateContentPayload,
} from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';
import { useIamAdminList } from './use-iam-admin-list';

type UseContentsResult = {
  readonly contents: readonly IamContentListItem[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
};

type UseContentDetailResult = {
  readonly content: IamContentDetail | null;
  readonly history: readonly IamContentHistoryEntry[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
  readonly updateContent: (payload: UpdateContentPayload) => Promise<boolean>;
};

type UseCreateContentResult = {
  readonly mutationError: IamHttpError | null;
  readonly clearMutationError: () => void;
  readonly createContent: (payload: CreateContentPayload) => Promise<boolean>;
};

export const useContents = (): UseContentsResult => {
  const { invalidatePermissions } = useAuth();
  const adminList = useIamAdminList(listContents, invalidatePermissions);

  return {
    contents: adminList.items,
    isLoading: adminList.isLoading,
    error: adminList.error,
    mutationError: adminList.mutationError,
    refetch: adminList.refetch,
    clearMutationError: adminList.clearMutationError,
  };
};

export const useCreateContent = (): UseCreateContentResult => {
  const { invalidatePermissions } = useAuth();
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const runMutation = React.useCallback(
    async (payload: CreateContentPayload) => {
      setMutationError(null);
      try {
        await createContent(payload);
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        return false;
      }
    },
    [invalidatePermissions]
  );

  return {
    mutationError,
    clearMutationError: () => setMutationError(null),
    createContent: runMutation,
  };
};

export const useContentDetail = (contentId: string | null): UseContentDetailResult => {
  const { invalidatePermissions } = useAuth();
  const [content, setContent] = React.useState<IamContentDetail | null>(null);
  const [history, setHistory] = React.useState<readonly IamContentHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    if (!contentId) {
      setContent(null);
      setHistory([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [contentResponse, historyResponse] = await Promise.all([getContent(contentId), getContentHistory(contentId)]);
      setContent({
        ...contentResponse.data,
        history: historyResponse.data,
      });
      setHistory(historyResponse.data);
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setContent(null);
      setHistory([]);
      setError(resolvedError);
    } finally {
      setIsLoading(false);
    }
  }, [contentId, invalidatePermissions]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const runMutation = React.useCallback(
    async (payload: UpdateContentPayload) => {
      setMutationError(null);
      if (!contentId) {
        return false;
      }
      try {
        await updateContent(contentId, payload);
        await refetch();
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        return false;
      }
    },
    [contentId, invalidatePermissions, refetch]
  );

  return {
    content,
    history,
    isLoading,
    error,
    mutationError,
    refetch,
    clearMutationError: () => setMutationError(null),
    updateContent: runMutation,
  };
};
