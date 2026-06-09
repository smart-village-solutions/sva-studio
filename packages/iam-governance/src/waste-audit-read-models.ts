import type {
  WasteManagementAuditOverview,
  WasteManagementAuditOutcome,
  WasteManagementTechnicalHistoryOverview,
  WasteManagementTechnicalHistoryRecord,
} from '@sva/core';

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

const technicalActionMap = {
  'waste-management.datasource.reconfigured': 'datasource.reconfigured',
  'waste-management.connection-check.succeeded': 'connection-check.succeeded',
  'waste-management.connection-check.failed': 'connection-check.failed',
  'waste-management.migrations.started': 'migration.started',
  'waste-management.import.started': 'import.started',
  'waste-management.seed.started': 'seed.started',
  'waste-management.reset.started': 'reset.started',
  'waste-management.sync-waste-types.started': 'sync.started',
} as const satisfies Readonly<Record<string, WasteManagementTechnicalHistoryRecord['eventType']>>;

const hasTechnicalAction = (actionId: string): actionId is keyof typeof technicalActionMap =>
  actionId in technicalActionMap;

const mapTechnicalAuditRow = (row: WasteAuditRow): WasteManagementTechnicalHistoryRecord | null => {
  const actionId = readString(row.payload?.action_id);
  if (!actionId || !hasTechnicalAction(actionId)) {
    return null;
  }

  const eventType = technicalActionMap[actionId];

  return {
    id: row.id,
    eventType,
    outcome: eventType.endsWith('.failed')
      ? 'failure'
      : eventType.endsWith('.succeeded')
        ? 'success'
        : 'started',
    occurredAt: row.created_at,
    source: 'audit',
    requestId: row.request_id ?? undefined,
    traceId: row.trace_id ?? undefined,
    errorCode: readString(row.payload?.reason_code),
  };
};

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

export const listWasteManagementTechnicalAuditRecords = async (
  client: QueryClient,
  input: WasteAuditFilters
): Promise<WasteManagementTechnicalHistoryOverview> => {
  const result = await loadWasteAuditRows(client, {
    ...input,
    actionIds: Object.keys(technicalActionMap),
  });
  const items = result.rows
    .map(mapTechnicalAuditRow)
    .filter((item): item is WasteManagementTechnicalHistoryRecord => item !== null);

  return {
    items,
    total: result.total,
  };
};
