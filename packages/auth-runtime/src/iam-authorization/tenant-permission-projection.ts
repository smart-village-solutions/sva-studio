import { withInstanceScopedDb } from './shared.js';
import {
  loadTenantPermissionProjectionSubjectsWithClient,
  ROLE_ASSIGNMENT_SOURCE_SQL,
  type TenantPermissionProjectionSubject,
} from './permission-store.queries.js';

export type { TenantPermissionProjectionSubject };

export const readTenantPermissionProjectionSubjects = async (input: {
  readonly instanceId: string;
  readonly permissionIds: readonly string[];
}): Promise<readonly TenantPermissionProjectionSubject[]> =>
  withInstanceScopedDb(
    input.instanceId,
    (client) => loadTenantPermissionProjectionSubjectsWithClient(client, input),
    { isolationLevel: 'repeatable read' }
  );

/** Directory eligibility is based on committed IAM state, never a stale projection subject list. */
export const hasActiveTenantPermissionProjectionSubject = async (input: {
  readonly instanceId: string;
  readonly permissionIds: readonly string[];
}): Promise<boolean> => {
  if (input.permissionIds.length === 0) return false;
  return withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<{ present: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM iam.accounts a
           JOIN iam.instance_memberships membership
             ON membership.instance_id = a.instance_id
            AND membership.account_id = a.id
           JOIN (
${ROLE_ASSIGNMENT_SOURCE_SQL}
           ) source
             ON source.account_id = a.id
            AND source.instance_id = a.instance_id
           JOIN iam.role_permissions rp
             ON rp.instance_id = source.instance_id
            AND rp.role_id = source.role_id
           JOIN iam.permissions p
             ON p.instance_id = rp.instance_id
            AND p.id = rp.permission_id
          WHERE a.instance_id = $1
            AND a.status = 'active'
            AND p.permission_key = ANY($2::text[])
       ) AS present`,
      [
        input.instanceId,
        [...new Set(input.permissionIds)].sort((left, right) => left.localeCompare(right)),
      ]
    );
    return result.rows[0]?.present === true;
  });
};
