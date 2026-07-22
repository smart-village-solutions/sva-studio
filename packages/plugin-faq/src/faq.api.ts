import { createMainserverCrudClient } from '@sva/plugin-sdk';

import type { GenericItemFaqInput, GenericItemFaqRecord } from './faq.types.js';

export type FaqListResult = Readonly<{
  readonly data: readonly GenericItemFaqRecord[];
  readonly pagination: Readonly<{ readonly page: number; readonly pageSize: number; readonly hasNextPage: boolean; readonly total?: number }>;
}>;

class FaqApiError extends Error {
  public constructor(public readonly code: string, message = code) {
    super(message);
    this.name = 'FaqApiError';
  }
}

const client = createMainserverCrudClient<GenericItemFaqRecord, GenericItemFaqInput, FaqListResult, FaqListResult, FaqApiError>({
  basePath: '/api/v1/mainserver/faqs',
  errorFactory: (code, message) => new FaqApiError(code, message),
  mapListResponse: (response) => response,
});

export const listFaqs = (query: Readonly<{ readonly page: number; readonly pageSize: number }>) => client.list(query);
export const getFaq = (id: string) => client.get(id);
export const createFaq = (input: GenericItemFaqInput) => client.create(input);
export const updateFaq = (id: string, input: GenericItemFaqInput) => client.update(id, input);
export const deleteFaq = (id: string) => client.remove(id);
export { FaqApiError };
