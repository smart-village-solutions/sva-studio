import { createInstanceIntegrationRepository, type SqlStatement } from '@sva/data';

import type { SvaMainserverInstanceConfig } from '../types';
import { SvaMainserverError } from './errors';
import { createPoolResolver, withInstanceDb } from './db';

const resolvePool = createPoolResolver(() => process.env.IAM_DATABASE_URL);

export const loadSvaMainserverInstanceConfig = async (
  instanceId: string
): Promise<SvaMainserverInstanceConfig> => {
  try {
    return await withInstanceDb(resolvePool, instanceId, async (client) => {
      const repository = createInstanceIntegrationRepository({
        async execute<TRow = Record<string, unknown>>(statement: SqlStatement) {
          const result = await client.query<TRow>(statement.text, statement.values);
          return {
            rowCount: result.rowCount,
            rows: result.rows,
          };
        },
      });

      const record = await repository.getByInstanceId(instanceId, 'sva_mainserver');
      if (!record) {
        throw new SvaMainserverError({
          code: 'config_not_found',
          message: `Keine SVA-Mainserver-Konfiguration für Instanz ${instanceId} gefunden.`,
          statusCode: 404,
        });
      }

      if (!record.enabled) {
        throw new SvaMainserverError({
          code: 'integration_disabled',
          message: `Die SVA-Mainserver-Integration ist für Instanz ${instanceId} deaktiviert.`,
          statusCode: 409,
        });
      }

      return {
        instanceId: record.instanceId,
        providerKey: record.providerKey,
        graphqlBaseUrl: record.graphqlBaseUrl,
        oauthTokenUrl: record.oauthTokenUrl,
        enabled: record.enabled,
        lastVerifiedAt: record.lastVerifiedAt,
        lastVerifiedStatus: record.lastVerifiedStatus,
      };
    });
  } catch (error) {
    if (error instanceof SvaMainserverError) {
      throw error;
    }

    throw new SvaMainserverError({
      code: 'database_unavailable',
      message: 'Die Instanzkonfiguration des SVA-Mainservers konnte nicht geladen werden.',
      statusCode: 503,
    });
  }
};
