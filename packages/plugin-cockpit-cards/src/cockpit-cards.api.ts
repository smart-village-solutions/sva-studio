import { createMainserverCrudClient, requestMainserverJson } from '@sva/plugin-sdk';
import type { MainserverActingPrincipalType } from '@sva/plugin-sdk';

import type {
  GenericItemCockpitCardInput,
  GenericItemCockpitCardRecord,
} from './cockpit-cards.types.js';

export type CockpitCardListResult = Readonly<{
  data: readonly GenericItemCockpitCardRecord[];
  pagination: Readonly<{ page: number; pageSize: number; hasNextPage: boolean; total?: number }>;
}>;

export type CockpitCardCategoryOption = Readonly<{ id: string; name: string }>;

export class CockpitCardsApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'CockpitCardsApiError';
  }
}

const client = createMainserverCrudClient<
  GenericItemCockpitCardRecord,
  GenericItemCockpitCardInput,
  CockpitCardListResult,
  CockpitCardListResult,
  CockpitCardsApiError
>({
  basePath: '/api/v1/mainserver/cockpit-cards',
  errorFactory: (code, message) => new CockpitCardsApiError(code, message),
  mapListResponse: (response) => response,
});

export const listCockpitCards = (query: Readonly<{ page: number; pageSize: number }>) =>
  client.list(query);
export const getCockpitCard = (id: string) => client.get(id);
export const createCockpitCard = (
  input: GenericItemCockpitCardInput,
  actingPrincipalType: MainserverActingPrincipalType
) => client.create(input, actingPrincipalType);
export const updateCockpitCard = (
  id: string,
  input: GenericItemCockpitCardInput,
  actingPrincipalType: MainserverActingPrincipalType
) => client.update(id, input, actingPrincipalType);
export const deleteCockpitCard = (id: string, actingPrincipalType: MainserverActingPrincipalType) =>
  client.remove(id, actingPrincipalType);

export const listCockpitCardCategories = async (): Promise<
  readonly CockpitCardCategoryOption[]
> => {
  const response = await requestMainserverJson<
    { readonly data: readonly CockpitCardCategoryOption[] },
    CockpitCardsApiError
  >({
    url: '/api/v1/mainserver/categories',
    errorFactory: (code, message) => new CockpitCardsApiError(code, message),
  });
  return response.data;
};
