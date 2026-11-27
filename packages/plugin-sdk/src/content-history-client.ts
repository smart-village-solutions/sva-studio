import type { IamContentHistoryEntry } from '@sva/core';

import { requestMainserverJson } from './mainserver-client.js';
import { MainserverApiError } from './mainserver-request.js';

type ApiListResponse<T> = Readonly<{
  data: readonly T[];
}>;

export const fetchIamContentHistory = async (
  contentId: string,
  options?: Readonly<{
    fetch?: typeof fetch;
    contentType?: string;
    signal?: AbortSignal;
  }>
): Promise<readonly IamContentHistoryEntry[]> => {
  const contentTypeQuery = options?.contentType
    ? `?contentType=${encodeURIComponent(options.contentType)}`
    : '';
  let response: ApiListResponse<IamContentHistoryEntry>;
  try {
    response = await requestMainserverJson<ApiListResponse<IamContentHistoryEntry>>({
      url: `/api/v1/iam/contents/${encodeURIComponent(contentId)}/history${contentTypeQuery}`,
      fetch: options?.fetch,
      init: options?.signal ? { signal: options.signal } : undefined,
    });
  } catch (error) {
    if (options?.contentType && error instanceof MainserverApiError && error.code === 'not_found') {
      return [];
    }
    throw error;
  }

  return response.data;
};
