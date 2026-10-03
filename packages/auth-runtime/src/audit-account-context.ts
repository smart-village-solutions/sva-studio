import {
  encryptFieldValue,
  parseFieldEncryptionConfigFromEnv,
  type FieldEncryptionConfig,
} from '@sva/core/security';

import type { AuthAuditEvent, AuthAuditEventType } from './audit-events.types.js';
import type { AuditSqlClient } from './audit-db-sink.js';
import { insertActivityLog } from './audit-event-writes.js';
import type { RuntimeScopeRef } from './types.js';

let cachedEncryptionConfig: FieldEncryptionConfig | null = null;
let cachedEncryptionConfigSignature: string | null = null;

const resolveEncryptionConfig = (): FieldEncryptionConfig | null => {
  const activeKeyId = process.env.IAM_PII_ACTIVE_KEY_ID ?? '';
  const keyringJson = process.env.IAM_PII_KEYRING_JSON ?? '';
  const signature = `${activeKeyId}::${keyringJson}`;

  if (signature === cachedEncryptionConfigSignature) {
    return cachedEncryptionConfig;
  }

  cachedEncryptionConfig = parseFieldEncryptionConfigFromEnv(process.env);
  cachedEncryptionConfigSignature = signature;
  return cachedEncryptionConfig;
};

const resolveAccountId = async (
  client: AuditSqlClient,
  input: { keycloakSubject: string; instanceId: string }
) => {
  const lookup = await client.query<{ id: string }>(
    `
SELECT id
FROM iam.accounts
WHERE keycloak_subject = $1
  AND instance_id = $2
LIMIT 1;
`,
    [input.keycloakSubject, input.instanceId]
  );

  if (lookup.rowCount <= 0) {
    return undefined;
  }

  return lookup.rows[0]?.id;
};

const encryptOptionalPii = (plaintext: string | undefined, aad: string): string | null => {
  if (!plaintext) {
    return null;
  }

  const config = resolveEncryptionConfig();
  if (!config) {
    return null;
  }

  return encryptFieldValue(plaintext, config, aad);
};

const ensureAccount = async (
  client: AuditSqlClient,
  input: {
    instanceId: string;
    keycloakSubject: string;
    encryptedEmailCiphertext: string | null;
    encryptedDisplayNameCiphertext: string | null;
  }
): Promise<{ accountId?: string; created: boolean }> => {
  const existingAccountId = await resolveAccountId(client, {
    keycloakSubject: input.keycloakSubject,
    instanceId: input.instanceId,
  });

  if (existingAccountId) {
    if (input.encryptedEmailCiphertext || input.encryptedDisplayNameCiphertext) {
      await client.query(
        `
UPDATE iam.accounts
SET
  email_ciphertext = COALESCE($3, email_ciphertext),
  display_name_ciphertext = COALESCE($4, display_name_ciphertext),
  updated_at = NOW()
WHERE keycloak_subject = $1
  AND instance_id = $2;
`,
        [
          input.keycloakSubject,
          input.instanceId,
          input.encryptedEmailCiphertext,
          input.encryptedDisplayNameCiphertext,
        ]
      );
    }

    return {
      accountId: existingAccountId,
      created: false,
    };
  }

  const inserted = await client.query<{ id: string }>(
    `
INSERT INTO iam.accounts (instance_id, keycloak_subject, email_ciphertext, display_name_ciphertext)
VALUES ($1, $2, $3, $4)
ON CONFLICT (keycloak_subject, instance_id) WHERE instance_id IS NOT NULL DO NOTHING
RETURNING id;
`,
    [
      input.instanceId,
      input.keycloakSubject,
      input.encryptedEmailCiphertext,
      input.encryptedDisplayNameCiphertext,
    ]
  );

  if (inserted.rowCount > 0) {
    return {
      accountId: inserted.rows[0]?.id,
      created: true,
    };
  }

  const accountId = await resolveAccountId(client, {
    keycloakSubject: input.keycloakSubject,
    instanceId: input.instanceId,
  });

  if (accountId && (input.encryptedEmailCiphertext || input.encryptedDisplayNameCiphertext)) {
    await client.query(
      `
UPDATE iam.accounts
SET
  email_ciphertext = COALESCE($3, email_ciphertext),
  display_name_ciphertext = COALESCE($4, display_name_ciphertext),
  updated_at = NOW()
WHERE keycloak_subject = $1
  AND instance_id = $2;
`,
      [
        input.keycloakSubject,
        input.instanceId,
        input.encryptedEmailCiphertext,
        input.encryptedDisplayNameCiphertext,
      ]
    );
  }

  return {
    accountId,
    created: false,
  };
};

export const resolveAuditAccountContext = async (
  client: AuditSqlClient,
  scope: RuntimeScopeRef,
  event: Required<Pick<AuthAuditEvent, 'workspaceId'>> & AuthAuditEvent
) => {
  if (scope.kind !== 'instance' || !event.actorUserId) {
    return {
      accountId: undefined,
      writtenEventTypes: [] as AuthAuditEventType[],
    };
  }

  if (event.eventType !== 'login' || event.outcome !== 'success') {
    return {
      accountId: await resolveAccountId(client, {
        keycloakSubject: event.actorUserId,
        instanceId: scope.instanceId,
      }),
      writtenEventTypes: [] as AuthAuditEventType[],
    };
  }

  const encryptedEmailCiphertext = encryptOptionalPii(
    event.actorEmail,
    `iam.accounts.email:${event.actorUserId}`
  );
  const encryptedDisplayNameCiphertext = encryptOptionalPii(
    event.actorDisplayName,
    `iam.accounts.display_name:${event.actorUserId}`
  );

  const ensured = await ensureAccount(client, {
    instanceId: scope.instanceId,
    keycloakSubject: event.actorUserId,
    encryptedEmailCiphertext,
    encryptedDisplayNameCiphertext,
  });
  const writtenEventTypes: AuthAuditEventType[] = [];

  if (ensured.created) {
    await insertActivityLog(client, {
      eventType: 'account_created',
      instanceId: scope.instanceId,
      accountId: ensured.accountId,
      actorUserId: event.actorUserId,
      outcome: 'success',
      requestId: event.requestId,
      traceId: event.traceId,
    });
    writtenEventTypes.push('account_created');
  }

  return {
    accountId: ensured.accountId,
    writtenEventTypes,
  };
};
