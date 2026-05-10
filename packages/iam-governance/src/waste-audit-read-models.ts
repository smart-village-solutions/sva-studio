import type { WasteManagementAuditOverview, WasteManagementAuditOutcome } from '@sva/core';

import type { QueryClient } from './query-client.js';
import { loadWasteAuditRows } from './waste-audit-read-models.queries.js';
import type { WasteAuditFilters, WasteAuditRow } from './waste-audit-read-models.types.js';

const readString = (value: unknown): string | undefined => (typeof value === 'string' && value.length > 0 ? value : undefined);

const readOutcome = (row: WasteAuditRow): WasteManagementAuditOutcome => {
  const result = readString(row.payload?.result);
  if (result === 'success' || result === 'failure' || result === 'denied') {
    return result;
  }

  const outcome = readString(row.payload?.outcome);
  if (outcome === 'success' || outcome === 'failure' || outcome === 'denied') {
    return outcome;
  }

  return row.event_type === 'plugin_action_denied' ? 'denied' : row.event_type === 'plugin_action_failed' ? 'failure' : 'success';
};

const mapWasteAuditRow = (row: WasteAuditRow): WasteManagementAuditOverview['items'][number] => ({
  id: row.id,
  actionId: readString(row.payload?.action_id) ?? row.event_type,
  actionNamespace: 'waste-management',
  actionOwner: 'waste-management',
  outcome: readOutcome(row),
  occurredAt: row.created_at,
  actorAccountId: row.account_id ?? undefined,
  resourceType: readString(row.payload?.resource_type),
  resourceId: readString(row.payload?.resource_id),
  reasonCode: readString(row.payload?.reason_code),
  requestId: row.request_id ?? undefined,
  traceId: row.trace_id ?? undefined,
});

export const listWasteManagementAuditRecords = async (
  client: QueryClient,
  input: WasteAuditFilters
): Promise<WasteManagementAuditOverview> => {
  const result = await loadWasteAuditRows(client, input);
  return {
    items: result.rows.map(mapWasteAuditRow),
    total: result.total,
  };
};
