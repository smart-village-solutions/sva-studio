import { requestJson, type FetchLike } from './http-client.js';
import type { HostMediaReferenceSelection } from './media-picker-client.js';

export type HostMediaContentSaveOperation = Readonly<{
  id: string;
  targetType: string;
  status: string;
  expiresAt: string;
}>;

export class HostMediaContentSaveHttpError extends Error {
  public constructor(public readonly status: number) {
    super(`media_content_save_http_${status}`);
    this.name = 'HostMediaContentSaveHttpError';
  }
}

const command = async <T>(input: {
  readonly fetch: FetchLike;
  readonly url: string;
  readonly method?: 'POST' | 'PUT';
  readonly body: Readonly<Record<string, unknown>>;
}): Promise<T> => {
  const response = await requestJson<{ data: T }>({
    fetch: input.fetch,
    url: input.url,
    errorFactory: (response) => new HostMediaContentSaveHttpError(response.status),
    init: {
      method: input.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(input.body),
    },
  });
  return response.data;
};

export const createHostMediaContentSaveOperation = (input: {
  readonly fetch: FetchLike;
  readonly operationId: string;
  readonly targetType: string;
  readonly instanceId?: string;
}): Promise<HostMediaContentSaveOperation> =>
  command({
    fetch: input.fetch,
    url: '/api/v1/iam/media/content-save-operations',
    body: {
      operationId: input.operationId,
      targetType: input.targetType,
      instanceId: input.instanceId,
    },
  });

export const markHostMediaContentSaveOperationSavingContent = (input: {
  readonly fetch: FetchLike;
  readonly operationId: string;
  readonly instanceId?: string;
}): Promise<unknown> =>
  command({
    fetch: input.fetch,
    url: `/api/v1/iam/media/content-save-operations/${encodeURIComponent(input.operationId)}/saving-content`,
    body: { instanceId: input.instanceId },
  });

export const markHostMediaContentSaveOperationOutcomeUnknown = (input: {
  readonly fetch: FetchLike;
  readonly operationId: string;
  readonly errorCode?: string;
  readonly instanceId?: string;
}): Promise<unknown> =>
  command({
    fetch: input.fetch,
    url: `/api/v1/iam/media/content-save-operations/${encodeURIComponent(input.operationId)}/outcome-unknown`,
    body: { instanceId: input.instanceId, errorCode: input.errorCode },
  });

export const replaceHostMediaContentSaveOperationReferences = (input: {
  readonly fetch: FetchLike;
  readonly operationId: string;
  readonly references: readonly HostMediaReferenceSelection[];
  readonly instanceId?: string;
}): Promise<unknown> =>
  command({
    fetch: input.fetch,
    method: 'PUT',
    url: `/api/v1/iam/media/content-save-operations/${encodeURIComponent(input.operationId)}/references`,
    body: { references: input.references, instanceId: input.instanceId },
  });

export const markHostMediaContentSaveOperationContentSaved = (input: {
  readonly fetch: FetchLike;
  readonly operationId: string;
  readonly targetId: string;
  readonly instanceId?: string;
}): Promise<unknown> =>
  command({
    fetch: input.fetch,
    url: `/api/v1/iam/media/content-save-operations/${encodeURIComponent(input.operationId)}/content-saved`,
    body: { targetId: input.targetId, instanceId: input.instanceId },
  });

export const commitHostMediaContentSaveOperation = (input: {
  readonly fetch: FetchLike;
  readonly operationId: string;
  readonly instanceId?: string;
}): Promise<unknown> =>
  command({
    fetch: input.fetch,
    url: `/api/v1/iam/media/content-save-operations/${encodeURIComponent(input.operationId)}/commit`,
    body: { instanceId: input.instanceId },
  });

export const abandonHostMediaContentSaveOperation = (input: {
  readonly fetch: FetchLike;
  readonly operationId: string;
  readonly errorCode?: string;
  readonly instanceId?: string;
}): Promise<unknown> =>
  command({
    fetch: input.fetch,
    url: `/api/v1/iam/media/content-save-operations/${encodeURIComponent(input.operationId)}/abandon`,
    body: { errorCode: input.errorCode, instanceId: input.instanceId },
  });
