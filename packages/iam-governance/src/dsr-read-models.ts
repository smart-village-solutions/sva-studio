import type { QueryClient } from './query-client.js';
import {
  buildAdminDsrItems,
  buildDsrSelfServiceOverview,
  filterAdminDsrItems,
  paginateDsrItems,
} from './dsr-read-models.mappers.js';
import { loadAdminDsrRows } from './dsr-read-models.admin-queries.js';
import { loadDsrSelfServiceRows } from './dsr-read-models.self-service-queries.js';
import type { DsrFilters } from './dsr-read-models.types.js';

export { toCanonicalDsrStatus } from './dsr-read-models.mappers.js';

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
