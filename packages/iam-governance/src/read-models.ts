import type { QueryClient } from './query-client.js';

import { buildGovernanceItems, filterGovernanceItems, paginateGovernanceItems } from './read-models.mappers.js';
import { loadGovernanceSourceRows } from './read-models.queries.js';
import type { GovernanceFilters } from './read-models.types.js';

export const listGovernanceCases = async (
  client: QueryClient,
  input: GovernanceFilters
): Promise<{ items: ReturnType<typeof paginateGovernanceItems>; total: number }> => {
  const rows = await loadGovernanceSourceRows(client, input);
  const items = filterGovernanceItems(buildGovernanceItems(rows), input);

  return {
    items: paginateGovernanceItems(items, input.page, input.pageSize),
    total: items.length,
  };
};
