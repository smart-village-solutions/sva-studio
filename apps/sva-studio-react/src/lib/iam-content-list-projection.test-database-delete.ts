import type { TestProjectionRow } from './iam-content-list-projection.test-database-types.js';
import type { TestSyncState } from './iam-content-list-projection.test-database-sync-state.js';

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
    projectionDeleteSql: string | null;
  },
  text: string,
  values: readonly unknown[] | undefined,
  queryValue: (values: readonly unknown[] | undefined, index: number, fallback?: unknown) => unknown
): { rows: unknown[]; rowCount: number } | null => {
  if (!text.includes('DELETE FROM iam.content_list_projection')) return null;
  fixture.projectionDeleteSql = text;
  if (text.includes('projection_scope_key <> $5')) {
    const previousCount = fixture.projectionRows.length;
    fixture.projectionRows = removeTransferredProjectionRows(fixture.projectionRows, values);
    return { rows: [], rowCount: previousCount - fixture.projectionRows.length };
  }
  const previousCount = fixture.projectionRows.length;
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
  const unscopedPredicate = text.match(
    /projection\.projection_scope_key <> \$(\d+) OR projection\.credential_source = \$(\d+)/
  );
  const unscopedKey = unscopedPredicate
    ? queryValue(values, Number(unscopedPredicate[1]) - 1)
    : null;
  const refreshCredentialSource = unscopedPredicate
    ? queryValue(values, Number(unscopedPredicate[2]) - 1)
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
    const matchingCredential =
      row.projection_scope_key !== unscopedKey || row.credential_source === refreshCredentialSource;
    return !(matchingScope && matchingEntity && matchingCredential);
  });
  return { rows: [], rowCount: previousCount - fixture.projectionRows.length };
};
