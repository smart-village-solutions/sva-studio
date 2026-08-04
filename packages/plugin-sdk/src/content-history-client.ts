import type { IamContentHistoryEntry } from '@sva/core';

import { requestMainserverJson } from './mainserver-client.js';

type ApiListResponse<T> = Readonly<{
  data: readonly T[];
}>;

export const fetchIamContentHistory = async (
  contentId: string,
  options?: Readonly<{
    fetch?: typeof fetch;
    contentType?: string;
  }>
): Promise<readonly IamContentHistoryEntry[]> => {
  const contentTypeQuery = options?.contentType
    ? `?contentType=${encodeURIComponent(options.contentType)}`
    : '';
  const response = await requestMainserverJson<ApiListResponse<IamContentHistoryEntry>>({
    url: `/api/v1/iam/contents/${encodeURIComponent(contentId)}/history${contentTypeQuery}`,
    fetch: options?.fetch,
  });

  return response.data;
};
