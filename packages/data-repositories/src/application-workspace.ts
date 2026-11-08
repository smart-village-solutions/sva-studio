/** Transaction-bound workspace storage; the host supplies verified instance scope. */
import type { CatalogSqlClient } from './app-translations-context.js';
export type StoredApplicationWorkspace = Readonly<{ version: number; tiles: readonly unknown[] }>;
export const readApplicationWorkspace = async (
  client: CatalogSqlClient,
  instanceId: string
): Promise<StoredApplicationWorkspace> => {
  const result = await client.query<StoredApplicationWorkspace>(
    'SELECT version, tiles FROM iam.application_workspace_settings WHERE instance_id = $1',
    [instanceId]
  );
  return result.rows[0] ?? { version: 0, tiles: [] };
};
export const saveApplicationWorkspace = async (
  client: CatalogSqlClient,
  instanceId: string,
  configuration: StoredApplicationWorkspace
): Promise<StoredApplicationWorkspace> => {
  const result =
    configuration.version === 0
      ? await client.query<StoredApplicationWorkspace>(
          `INSERT INTO iam.application_workspace_settings (instance_id,version,tiles) VALUES ($1,1,$2::jsonb) ON CONFLICT (instance_id) DO NOTHING RETURNING version,tiles`,
          [instanceId, JSON.stringify(configuration.tiles)]
        )
      : await client.query<StoredApplicationWorkspace>(
          `UPDATE iam.application_workspace_settings SET version=version+1,tiles=$3::jsonb,updated_at=now() WHERE instance_id=$1 AND version=$2 RETURNING version,tiles`,
          [instanceId, configuration.version, JSON.stringify(configuration.tiles)]
        );
  if (!result.rows[0]) throw new Error('workspace_version_conflict');
  return result.rows[0];
};
