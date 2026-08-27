import type { TestProjectionRow } from './iam-content-list-projection.test-database-types.js';

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
