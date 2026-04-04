import type {
  IamUserDetail,
} from '@sva/core';
import { createSdkLogger } from '@sva/sdk/server';

import type { QueryClient } from '../shared/db-helpers.js';

import { mapUserDetailRow } from './user-detail-query.mapping.js';
import { readUserDetailSchemaSupport, selectUserDetailQuery } from './user-detail-query.sql.js';
import type { UserDetailRow } from './user-detail-query.types.js';

const logger = createSdkLogger({ component: 'iam-user-detail-query', level: 'info' });

const logMissingUserDetail = (input: { instanceId: string; userId: string }): void => {
  logger.info('IAM user detail query returned no row', {
    operation: 'resolve_user_detail',
    instance_id: input.instanceId,
    user_id: input.userId,
  });
};

const buildErrorContext = (input: { instanceId: string; userId: string }, error: unknown) => ({
  operation: 'resolve_user_detail',
  instance_id: input.instanceId,
  user_id: input.userId,
  error_type: error instanceof Error ? error.constructor.name : typeof error,
  error: error instanceof Error ? error.message : String(error),
  error_stack: error instanceof Error ? error.stack : undefined,
});

export const resolveUserDetail = async (
  client: QueryClient,
  input: { instanceId: string; userId: string }
): Promise<IamUserDetail | undefined> => {
  try {
    const schemaSupport = await readUserDetailSchemaSupport(client);
    const detailQuery = selectUserDetailQuery(schemaSupport);
    const result = await client.query<UserDetailRow>(detailQuery, [input.instanceId, input.userId]);
    const row = result.rows[0];
    if (!row) {
      logMissingUserDetail(input);
      return undefined;
    }

    try {
      return mapUserDetailRow(row);
    } catch (error) {
      logger.error('IAM user detail mapping failed', {
        ...buildErrorContext(input, error),
        keycloak_subject: row.keycloak_subject,
      });
      throw error;
    }
  } catch (error) {
    logger.error('IAM user detail query failed', buildErrorContext(input, error));
    throw error;
  }
};
