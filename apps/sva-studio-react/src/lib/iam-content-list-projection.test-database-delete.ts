import type { TestProjectionRow } from './iam-content-list-projection.test-database-types.js';
import {
  hasNewerSiblingSync,
  type TestSyncState,
} from './iam-content-list-projection.test-database-sync-state.js';

export const removeTransferredProjectionRows = (
  rows: readonly TestProjectionRow[],
  values: readonly unknown[] | undefined
): TestProjectionRow[] => {
  const [instanceId, contentType, sourceEntityType, sourceEntityId, retainedScopeKey] = (
    values ?? []
  ).map(String);
  return rows.filter(
    (row) =>
      row.instance_id !== instanceId ||
      row.source_system !== 'mainserver' ||
      row.content_type !== contentType ||
      row.source_entity_type !== sourceEntityType ||
      row.source_entity_id !== sourceEntityId ||
      row.projection_scope_key === retainedScopeKey
  );
};

export const matchesMainserverDeleteScope = (
  row: TestProjectionRow,
  instanceId: string,
  contentType: string,
  scopeValue: unknown,
  hasScopePredicate: boolean
): boolean =>
  row.instance_id === instanceId &&
  row.source_system === 'mainserver' &&
  row.content_type === contentType &&
  (!hasScopePredicate ||
    (Array.isArray(scopeValue)
      ? scopeValue.includes(row.projection_scope_key)
      : row.projection_scope_key === scopeValue));

export const deleteProjectionQueryResult = (
  fixture: {
    projectionRows: TestProjectionRow[];
    projectionScopeKeyColumnAvailable: boolean;
    syncStates: Map<string, TestSyncState>;
  },
  text: string,
  values: readonly unknown[] | undefined,
  queryValue: (values: readonly unknown[] | undefined, index: number, fallback?: unknown) => unknown
): { rows: unknown[]; rowCount: number } | null => {
  if (!text.includes('DELETE FROM iam.content_list_projection')) return null;
  if (text.includes('projection_scope_key <> $5')) {
    fixture.projectionRows = removeTransferredProjectionRows(fixture.projectionRows, values);
    return { rows: [], rowCount: 0 };
  }
  const instanceId = String(queryValue(values, 0));
  const contentType = String(queryValue(values, 1));
  const hasScopePredicate =
    fixture.projectionScopeKeyColumnAvailable && text.includes('projection_scope_key =');
  const scopeValue = hasScopePredicate ? queryValue(values, 2) : null;
  const entityParameter = text.match(/(?:projection\.)?source_entity_id = (?:ANY\()?\$(\d+)/);
  const entityValue = entityParameter
    ? queryValue(values, Number(entityParameter[1]) - 1, null)
    : null;
  const sourceEntityId = typeof entityValue === 'string' ? entityValue : null;
  const retainedEntityIds = Array.isArray(entityValue)
    ? entityValue.filter((value): value is string => typeof value === 'string')
    : null;
  fixture.projectionRows = fixture.projectionRows.filter((row) => {
    const matchingScope = matchesMainserverDeleteScope(
      row,
      instanceId,
      contentType,
      scopeValue,
      hasScopePredicate
    );
    const matchingEntity = retainedEntityIds
      ? !retainedEntityIds.includes(row.source_entity_id)
      : sourceEntityId === null || row.source_entity_id === sourceEntityId;
    const targetScopeKey = String(queryValue(values, 3, ''));
    const newerSibling =
      text.includes('sync_state AS sibling') &&
      hasNewerSiblingSync(fixture, contentType, targetScopeKey, row.projection_scope_key);
    return !(matchingScope && matchingEntity && !newerSibling);
  });
  return { rows: [], rowCount: 0 };
};
