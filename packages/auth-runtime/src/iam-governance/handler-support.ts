import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { createPoolResolver, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { buildLogContext } from '../log-context.js';
import { createApiError } from '../iam-account-management/api-helpers.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import type { AuthenticatedRequestContext } from '../middleware.js';

export const GOVERNANCE_READ_ACTION = 'iam.governance.read';
export const GOVERNANCE_WRITE_ACTION = 'iam.governance.write';
export const GOVERNANCE_EXPORT_ACTION = 'iam.governance.export';
export const logger = createSdkLogger({ component: 'iam-governance', level: 'info' });
const resolvePool = createPoolResolver(getIamDatabaseUrl);

export const buildGovernanceLogContext = (instanceId?: string) =>
  buildLogContext(instanceId, { includeTraceId: true });

export const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withResolvedInstanceDb(resolvePool, instanceId, work);

export const authorizeGovernanceAction = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  message: string
) => {
  const authorization = await authorizeInstancePermissionForUser({ ctx, action });
  if (authorization.ok) {
    return null;
  }

  return createApiError(
    authorization.status,
    toInstancePermissionApiErrorCode(authorization.error),
    message,
    getWorkspaceContext().requestId,
    authorization.permissionDenial
  );
};
