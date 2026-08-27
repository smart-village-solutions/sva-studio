import type {
  ContentProjectionSyncTarget,
  MainserverProjectionRowInput,
  ProjectionDbClient,
} from './iam-content-list-projection-model.server.js';
import {
  buildProjectionTargetKey,
  loadProjectionTableSchemaMode,
  withProjectionSchemaModeRetry,
} from './iam-content-list-projection-repository-schema.server.js';

export const deleteTransferredProjectionRowsFromOtherScopes = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  row: MainserverProjectionRowInput
): Promise<void> => {
  if (!target.ownershipPrincipal) return;
  await withProjectionSchemaModeRetry(target, 'table', async () => {
    if ((await loadProjectionTableSchemaMode(client, target.instanceId)) !== 'scoped') return;
    await client.query(
      `DELETE FROM iam.content_list_projection
       WHERE instance_id = $1
         AND source_system = 'mainserver'
         AND content_type = $2
         AND source_entity_type = $3
         AND source_entity_id = $4
         AND projection_scope_key <> $5;`,
      [
        target.instanceId,
        target.contentType,
        row.sourceEntityType,
        row.sourceEntityId,
        buildProjectionTargetKey(target),
      ]
    );
  });
};
