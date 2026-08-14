import type { AcceptanceRecorder, Pool } from './iam-acceptance-runner-runtime.ts';

type AccountRow = {
  id: string;
  keycloak_subject: string;
};

const queryAccount = async (
  pool: Pool,
  input: { instanceId: string; keycloakSubject: string }
): Promise<AccountRow[]> => {
  const result = await pool.query<AccountRow>(
    `
SELECT id, keycloak_subject
FROM iam.accounts
WHERE instance_id = $1
  AND keycloak_subject = $2
ORDER BY created_at ASC;
`,
    [input.instanceId, input.keycloakSubject]
  );
  return result.rows;
};

export const assertSingleProvisionedAccount = async (
  recorder: AcceptanceRecorder,
  input: { instanceId: string; keycloakSubject: string; name: string; pool: Pool }
): Promise<{ accountId: string }> => {
  const rows = await queryAccount(input.pool, input);
  if (rows.length !== 1) {
    recorder.failStep({
      name: `${input.name} JIT-Provisioning`,
      failureCode: 'acceptance_database_query_failed',
      details: `Erwartet genau einen Account-Datensatz für ${input.keycloakSubject}, gefunden: ${rows.length}.`,
      metadata: { rows },
    });
  }

  const accountId = rows[0]?.id;
  const membershipResult = await input.pool.query<{ account_id: string }>(
    `
SELECT account_id
FROM iam.instance_memberships
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
    [input.instanceId, accountId]
  );
  if (membershipResult.rowCount !== 1) {
    recorder.failStep({
      name: `${input.name} JIT-Provisioning`,
      failureCode: 'acceptance_membership_missing',
      details: `Die Instanz-Mitgliedschaft für ${input.keycloakSubject} fehlt.`,
      metadata: { accountId },
    });
  }

  return { accountId: accountId as string };
};

export const cleanupAcceptanceOrganizations = async (
  pool: Pool,
  input: { instanceId: string; organizationKeyPrefix: string }
): Promise<void> => {
  const organizations = await pool.query<{ id: string }>(
    `
SELECT id
FROM iam.organizations
WHERE instance_id = $1
  AND organization_key LIKE $2
ORDER BY depth DESC;
`,
    [input.instanceId, `${input.organizationKeyPrefix}-%`]
  );
  const ids = organizations.rows.map((row) => row.id);
  if (ids.length === 0) {
    return;
  }
  await pool.query(
    `
DELETE FROM iam.account_organizations
WHERE instance_id = $1
  AND organization_id = ANY($2::uuid[]);
`,
    [input.instanceId, ids]
  );
  for (const organizationId of ids) {
    await pool.query(
      `
DELETE FROM iam.organizations
WHERE instance_id = $1
  AND id = $2::uuid;
`,
      [input.instanceId, organizationId]
    );
  }
};

export const cleanupAcceptanceAccounts = async (
  recorder: AcceptanceRecorder,
  pool: Pool,
  input: { instanceId: string; keycloakSubjects: readonly string[] }
): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const accounts = await client.query<{ id: string }>(
      `
SELECT id
FROM iam.accounts
WHERE instance_id = $1
  AND keycloak_subject = ANY($2::text[]);
`,
      [input.instanceId, input.keycloakSubjects]
    );
    const accountIds = accounts.rows.map((row) => row.id);
    if (accountIds.length > 0) {
      for (const table of [
        'account_organizations',
        'account_roles',
        'instance_memberships',
      ] as const) {
        await client.query(
          `DELETE FROM iam.${table} WHERE instance_id = $1 AND account_id = ANY($2::uuid[]);`,
          [input.instanceId, accountIds]
        );
      }
      await client.query(
        `
DELETE FROM iam.activity_logs
WHERE instance_id = $1
  AND (account_id = ANY($2::uuid[]) OR subject_id = ANY($2::uuid[]));
`,
        [input.instanceId, accountIds]
      );
      await client.query(
        `DELETE FROM iam.accounts WHERE instance_id = $1 AND id = ANY($2::uuid[]);`,
        [input.instanceId, accountIds]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    recorder.failStep({
      name: 'Testdaten-Reset',
      failureCode: 'acceptance_test_data_reset_failed',
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    client.release();
  }
};
