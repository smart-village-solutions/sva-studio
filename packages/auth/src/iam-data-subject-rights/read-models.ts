import type { QueryClient } from '../shared/db-helpers';
import {
  buildAdminDsrItems,
  buildDsrSelfServiceOverview,
  filterAdminDsrItems,
  paginateDsrItems,
  toCanonicalDsrStatus,
} from './read-models.mappers';
import { loadAdminDsrRows } from './read-models.admin-queries';
import { loadDsrSelfServiceRows } from './read-models.self-service-queries';
import type { DsrFilters } from './read-models.types';

export { toCanonicalDsrStatus } from './read-models.mappers';

export const loadDsrSelfServiceOverview = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<ReturnType<typeof buildDsrSelfServiceOverview>> =>
  buildDsrSelfServiceOverview(await loadDsrSelfServiceRows(client, input), input);

export const listAdminDsrCases = async (
  client: QueryClient,
  input: DsrFilters
): Promise<{ items: ReturnType<typeof paginateDsrItems>; total: number }> => {
  const items = filterAdminDsrItems(buildAdminDsrItems(await loadAdminDsrRows(client, input)), input);

  return {
    items: paginateDsrItems(items, input.page, input.pageSize),
    total: items.length,
  };
};
