import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';

import { createPoolResolver, type QueryClient, withInstanceDb } from './shared/db-helpers';
import { isUuid } from './shared/input-readers';

const logger = createSdkLogger({ component: 'iam-service', level: 'info' });
const resolvePool = createPoolResolver(() => process.env.IAM_DATABASE_URL);

export type JitProvisionInput = {
  readonly instanceId?: string;
  readonly keycloakSubject?: string;
};

export type JitProvisionResult =
  | {
      readonly skipped: true;
      readonly reason: 'missing_instance' | 'invalid_instance' | 'missing_subject' | 'missing_database';
    }
  | {
      readonly skipped: false;
      readonly accountId: string;
      readonly created: boolean;
    };

export const jitProvisionAccountWithClient = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string; requestId?: string; traceId?: string }
): Promise<{ accountId: string; created: boolean }> => {
  const upsert = await client.query<{ id: string; created: boolean }>(
    `
INSERT INTO iam.accounts (
  instance_id,
  keycloak_subject,
  status
)
VALUES ($1::uuid, $2, 'pending')
ON CONFLICT (keycloak_subject, instance_id) DO UPDATE
SET updated_at = NOW()
RETURNING id, (xmax = 0) AS created;
`,
    [input.instanceId, input.keycloakSubject]
  );

  const accountId = upsert.rows[0]?.id;
  const created = Boolean(upsert.rows[0]?.created);
  if (!accountId) {
    throw new Error('jit_provision_failed');
  }

  await client.query(
    `
INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
VALUES ($1::uuid, $2::uuid, 'member')
ON CONFLICT (instance_id, account_id) DO NOTHING;
`,
    [input.instanceId, accountId]
  );

  if (created) {
    await client.query(
      `
INSERT INTO iam.activity_logs (
  instance_id,
  account_id,
  subject_id,
  event_type,
  result,
  payload,
  request_id,
  trace_id
)
VALUES ($1::uuid, $2::uuid, $2::uuid, 'user.jit_provisioned', 'success', '{}'::jsonb, $3, $4);
`,
      [input.instanceId, accountId, input.requestId ?? null, input.traceId ?? null]
    );
  }

  return { accountId, created };
};

export const jitProvisionAccount = async (input: JitProvisionInput): Promise<JitProvisionResult> => {
  const instanceId = input.instanceId;
  const keycloakSubject = input.keycloakSubject;

  if (!instanceId) {
    return { skipped: true, reason: 'missing_instance' };
  }
  if (!isUuid(instanceId)) {
    return { skipped: true, reason: 'invalid_instance' };
  }
  if (!keycloakSubject) {
    return { skipped: true, reason: 'missing_subject' };
  }

  const pool = resolvePool();
  if (!pool) {
    return { skipped: true, reason: 'missing_database' };
  }

  const context = getWorkspaceContext();

  const result = await withInstanceDb(resolvePool, instanceId, (client) =>
    jitProvisionAccountWithClient(client, {
      instanceId,
      keycloakSubject,
      requestId: context.requestId,
      traceId: context.traceId,
    })
  );

  logger.info('JIT provisioning processed', {
    operation: 'jit_provision',
    instance_id: instanceId,
    keycloak_subject: keycloakSubject,
    account_created: result.created,
    request_id: context.requestId,
    trace_id: context.traceId,
  });

  return {
    skipped: false,
    accountId: result.accountId,
    created: result.created,
  };
};
