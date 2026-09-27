import { withInstanceScopedDb } from './shared.js';
import {
  loadTenantPermissionProjectionSubjectsWithClient,
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
export const hasActiveTenantProjectionSubject = async (input: {
  readonly instanceId: string;
}): Promise<boolean> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<{ present: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM iam.accounts a
           JOIN iam.instance_memberships membership
             ON membership.instance_id = a.instance_id
            AND membership.account_id = a.id
          WHERE a.instance_id = $1
            AND a.status = 'active'
            AND a.is_blocked = false
            AND a.soft_deleted_at IS NULL
            AND a.deletion_lifecycle_state = 'active'
       ) AS present`,
      [input.instanceId]
    );
    return result.rows[0]?.present === true;
  });
