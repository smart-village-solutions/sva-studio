import type { SqlExecutor } from '../iam/repositories/types.js';

import type { InstanceRegistryRepository } from './repository-contract.js';
import { buildInstanceSelectColumns } from './repository-instance-select.js';
import { mapInstance } from './repository-mappers.js';
import { queryRows, statement } from './repository-shared.js';
import type { InstanceListRow } from './repository-types.js';

type ReadRepository = Pick<
  InstanceRegistryRepository,
  | 'listInstances'
  | 'getInstanceById'
  | 'listAssignedModules'
  | 'countLocalSystemAdminAssignments'
  | 'getAuthClientSecretCiphertext'
  | 'getTenantAdminClientSecretCiphertext'
  | 'resolveHostname'
  | 'resolvePrimaryHostname'
>;

const mapFirstInstance = (rows: readonly InstanceListRow[]) => (rows[0] ? mapInstance(rows[0]) : null);

const listInstances = async (
  executor: SqlExecutor,
  input: { search?: string; status?: string } = {}
): Promise<readonly ReturnType<typeof mapInstance>[]> => {
  const rows = await queryRows<InstanceListRow>(
    executor,
    statement(
      `
SELECT
${buildInstanceSelectColumns()}
FROM iam.instances
WHERE ($1::text IS NULL OR id ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR status = $2)
ORDER BY updated_at DESC, id ASC;
`,
      [input.search?.trim() || null, input.status ?? null]
    )
  );
  return rows.map(mapInstance);
};

const getInstanceById = async (executor: SqlExecutor, instanceId: string) => {
  const rows = await queryRows<InstanceListRow>(
    executor,
    statement(
      `
SELECT
${buildInstanceSelectColumns()}
FROM iam.instances
WHERE id = $1
LIMIT 1;
`,
      [instanceId]
    )
  );
  return mapFirstInstance(rows);
};

const listAssignedModules = async (executor: SqlExecutor, instanceId: string): Promise<readonly string[]> => {
  const rows = await queryRows<{ module_id: string }>(
    executor,
    statement(
      `
SELECT module_id
FROM iam.instance_modules
WHERE instance_id = $1
ORDER BY module_id ASC;
`,
      [instanceId]
    )
  );
  return rows.map((row) => row.module_id);
};

const countLocalSystemAdminAssignments = async (executor: SqlExecutor, instanceId: string): Promise<number> => {
  const rows = await queryRows<{ assignment_count: number | string }>(
    executor,
    statement(
      `
SELECT COUNT(DISTINCT ar.account_id)::int AS assignment_count
FROM iam.account_roles ar
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
JOIN iam.instance_memberships im
  ON im.instance_id = ar.instance_id
 AND im.account_id = ar.account_id
WHERE ar.instance_id = $1
  AND r.role_key = 'system_admin'
  AND ar.valid_from <= NOW()
  AND (ar.valid_to IS NULL OR ar.valid_to > NOW());
`,
      [instanceId]
    )
  );
  const rawCount = rows[0]?.assignment_count;
  return typeof rawCount === 'string' ? Number.parseInt(rawCount, 10) || 0 : rawCount ?? 0;
};

const getAuthClientSecretCiphertext = async (executor: SqlExecutor, instanceId: string): Promise<string | null> => {
  const rows = await queryRows<{ auth_client_secret_ciphertext: string | null }>(
    executor,
    statement(
      `
SELECT auth_client_secret_ciphertext
FROM iam.instances
WHERE id = $1
LIMIT 1;
`,
      [instanceId]
    )
  );
  return rows[0]?.auth_client_secret_ciphertext ?? null;
};

const getTenantAdminClientSecretCiphertext = async (
  executor: SqlExecutor,
  instanceId: string
): Promise<string | null> => {
  const rows = await queryRows<{ tenant_admin_client_secret_ciphertext: string | null }>(
    executor,
    statement(
      `
SELECT tenant_admin_client_secret_ciphertext
FROM iam.instances
WHERE id = $1
LIMIT 1;
`,
      [instanceId]
    )
  );
  return rows[0]?.tenant_admin_client_secret_ciphertext ?? null;
};

const resolveHostname = async (executor: SqlExecutor, hostname: string) => {
  const rows = await queryRows<InstanceListRow>(
    executor,
    statement(
      `
SELECT
${buildInstanceSelectColumns('instance')}
FROM iam.instance_hostnames hostname
JOIN iam.instances instance
  ON instance.id = hostname.instance_id
WHERE hostname.hostname = $1
LIMIT 1;
`,
      [hostname]
    )
  );
  return mapFirstInstance(rows);
};

const resolvePrimaryHostname = async (executor: SqlExecutor, hostname: string) => {
  const rows = await queryRows<InstanceListRow>(
    executor,
    statement(
      `
SELECT
${buildInstanceSelectColumns()}
FROM iam.instances
WHERE primary_hostname = $1
LIMIT 1;
`,
      [hostname]
    )
  );
  return mapFirstInstance(rows);
};

export const createReadRepository = (executor: SqlExecutor): ReadRepository => ({
  listInstances: (input) => listInstances(executor, input),
  getInstanceById: (instanceId) => getInstanceById(executor, instanceId),
  listAssignedModules: (instanceId) => listAssignedModules(executor, instanceId),
  countLocalSystemAdminAssignments: (instanceId) => countLocalSystemAdminAssignments(executor, instanceId),
  getAuthClientSecretCiphertext: (instanceId) => getAuthClientSecretCiphertext(executor, instanceId),
  getTenantAdminClientSecretCiphertext: (instanceId) => getTenantAdminClientSecretCiphertext(executor, instanceId),
  resolveHostname: (hostname) => resolveHostname(executor, hostname),
  resolvePrimaryHostname: (hostname) => resolvePrimaryHostname(executor, hostname),
});
