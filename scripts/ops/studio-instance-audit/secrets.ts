import type { AuditCheckResult } from './model.ts';
import type { createStudioRemoteSqlClient } from './remote-sql.ts';
import { sqlLiteral } from './remote-sql.ts';
import { revealField } from '../../../packages/auth-runtime/src/iam-account-management/encryption.ts';

type RemoteSqlClient = ReturnType<typeof createStudioRemoteSqlClient>;

type SecretRow = Readonly<{
  auth_client_secret_ciphertext: string | null;
  tenant_admin_client_secret_ciphertext: string | null;
}>;

export type TenantSecretInspection = Readonly<{
  adminSecret?: string;
  authSecret?: string;
  checks: readonly AuditCheckResult[];
}>;

const buildAuthClientSecretAad = (instanceId: string): string => `iam.instances.auth_client_secret:${instanceId}`;
const buildTenantAdminClientSecretAad = (instanceId: string): string =>
  `iam.instances.tenant_admin_client_secret:${instanceId}`;

export const inspectTenantSecrets = async (
  client: Pick<RemoteSqlClient, 'queryOne'>,
  instanceId: string,
): Promise<TenantSecretInspection> => {
  const row = await client.queryOne<SecretRow>(`
SELECT
  auth_client_secret_ciphertext,
  tenant_admin_client_secret_ciphertext
FROM iam.instances
WHERE id = ${sqlLiteral(instanceId)}
LIMIT 1
`);

  const authSecret = row?.auth_client_secret_ciphertext
    ? revealField(row.auth_client_secret_ciphertext, buildAuthClientSecretAad(instanceId)) ?? undefined
    : undefined;
  const adminSecret = row?.tenant_admin_client_secret_ciphertext
    ? revealField(row.tenant_admin_client_secret_ciphertext, buildTenantAdminClientSecretAad(instanceId)) ?? undefined
    : undefined;

  return {
    adminSecret,
    authSecret,
    checks: [
      {
        checkId: 'secrets.login.readable',
        details: { configured: Boolean(row?.auth_client_secret_ciphertext) },
        status: authSecret ? 'pass' : 'fail',
        summary: authSecret ? 'tenant secret readable' : 'tenant auth client secret missing or unreadable',
        title: 'Login-Client-Secret ist lesbar',
      },
      {
        checkId: 'secrets.tenant_admin.readable',
        details: { configured: Boolean(row?.tenant_admin_client_secret_ciphertext) },
        status: adminSecret ? 'pass' : 'fail',
        summary: adminSecret ? 'tenant admin secret readable' : 'tenant admin client secret missing or unreadable',
        title: 'Tenant-Admin-Client-Secret ist lesbar',
      },
    ],
  };
};
