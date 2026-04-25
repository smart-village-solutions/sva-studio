import { createRoleReadHandlers } from '@sva/iam-admin';
import { getWorkspaceContext } from '@sva/server-runtime';
import type { IamPermission } from '@sva/core';

import { jsonResponse, type QueryClient } from '../db.js';

import { asApiList, createApiError } from './api-helpers.js';
import { classifyIamDiagnosticError } from './diagnostics.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { listPlatformRolesInternal } from './platform-iam-handlers.js';
import { consumeRateLimit } from './rate-limit.js';
import { loadRoleListItems } from './role-query.js';
import { requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { withInstanceScopedDb } from './shared-runtime.js';

const loadPermissions = async (
  client: QueryClient,
  instanceId: string
): Promise<readonly IamPermission[]> => {
  const result = await client.query<{
    id: string;
    instance_id: string;
    permission_key: string;
    description: string | null;
  }>(
    `
SELECT
  p.id,
  p.instance_id,
  p.permission_key,
  p.description
FROM iam.permissions p
WHERE p.instance_id = $1
ORDER BY p.permission_key ASC;
`,
    [instanceId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    instanceId: row.instance_id,
    permissionKey: row.permission_key,
    ...(row.description ? { description: row.description } : {}),
  }));
};

const roleReadHandlers = createRoleReadHandlers({
  asApiList,
  classifyIamDiagnosticError,
  consumeRateLimit,
  createApiError,
  ensureFeature,
  getFeatureFlags,
  getWorkspaceContext,
  jsonResponse,
  listPlatformRolesInternal,
  loadPermissions: (instanceId) => withInstanceScopedDb(instanceId, (client) => loadPermissions(client, instanceId)),
  loadRoleListItems: (instanceId) => withInstanceScopedDb(instanceId, (client) => loadRoleListItems(client, instanceId)),
  requireRoles,
  resolveActorInfo,
});

export const { listPermissionsInternal, listRolesInternal } = roleReadHandlers;

export { createRoleInternal } from './roles-handlers.create.js';
export { deleteRoleInternal } from './roles-handlers.delete.js';
export { updateRoleInternal } from './roles-handlers.update.js';
