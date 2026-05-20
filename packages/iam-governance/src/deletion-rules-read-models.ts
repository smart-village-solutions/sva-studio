import type { IamMyDeletionRulesOverview, IamTenantDeletionRulesOverview } from '@sva/core';

import { buildMyDeletionRulesOverview, buildTenantDeletionRulesOverview } from './deletion-rules-read-models.mappers.js';
import { loadMyDeletionRulesRow, loadTenantDeletionRulesRow } from './deletion-rules-read-models.queries.js';
import type { QueryClient } from './query-client.js';

export { DeletionRulesAccountNotFoundError } from './deletion-rules-read-models.queries.js';

export const loadTenantDeletionRulesOverview = async (
  client: QueryClient,
  input: { instanceId: string; canEdit: boolean }
): Promise<IamTenantDeletionRulesOverview> =>
  buildTenantDeletionRulesOverview(await loadTenantDeletionRulesRow(client, input), input);

export const loadMyDeletionRulesOverview = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<IamMyDeletionRulesOverview> =>
  buildMyDeletionRulesOverview(await loadMyDeletionRulesRow(client, input), input);
