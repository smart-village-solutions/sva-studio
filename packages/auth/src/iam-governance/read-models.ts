import type { QueryClient } from '../shared/db-helpers';

import { buildGovernanceItems, filterGovernanceItems, paginateGovernanceItems } from './read-models.mappers';
import { loadGovernanceSourceRows } from './read-models.queries';
import type { GovernanceFilters } from './read-models.types';

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
