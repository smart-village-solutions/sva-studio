import type { IamContentDetail, IamContentHistoryEntry } from '@sva/core';

import { createOperationLogger } from '../lib/browser-operation-logging';

export type UseContentDetailResult = {
  readonly content: IamContentDetail | null;
  readonly history: readonly IamContentHistoryEntry[];
  readonly isLoading: boolean;
  readonly error: import('../lib/iam-api').IamHttpError | null;
  readonly mutationError: import('../lib/iam-api').IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
  readonly updateContent: (payload: import('../lib/iam-api').UpdateContentPayload) => Promise<boolean>;
};

export type UseCreateContentResult = {
  readonly mutationError: import('../lib/iam-api').IamHttpError | null;
  readonly clearMutationError: () => void;
  readonly createContent: (payload: import('../lib/iam-api').CreateContentPayload) => Promise<boolean>;
};

export const contentsLogger = createOperationLogger('contents-hook', 'debug');
export const PERMISSION_INVALIDATED_EVENT = 'permission_invalidated_after_401_or_403';
