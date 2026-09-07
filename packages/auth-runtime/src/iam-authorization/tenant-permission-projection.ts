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
