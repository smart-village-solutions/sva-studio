import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import { encryptFieldValue, parseFieldEncryptionConfigFromEnv } from '@sva/core/security';
import { appendDsrRequestEvent, emitDsrAuditEvent } from '@sva/iam-governance/dsr-persistence';
import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse, type QueryClient } from '../db.js';
import type { DsrExportAccountSnapshot as AccountSnapshot } from '@sva/iam-governance/dsr-export-payload';
import { readString } from '../shared/input-readers.js';
import {
  handleJsonDatabaseError,
  jsonError,
  requireJsonBody,
  resolveJsonScopedInstance,
  withInstanceScopedDb,
} from './shared.js';
import {
  createDsrRequest,
  ensureArt19RecipientRows,
  resolveAccountBySubject,
} from './persistence.js';

export const profileCorrectionHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const bodyResult = await requireJsonBody(request);
      if (!bodyResult.ok) {
        return bodyResult.response;
      }
      const { body } = bodyResult;

      const instanceScope = resolveJsonScopedInstance({
        bodyInstanceId: readString(body.instanceId),
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
      });
      const nextEmail = readString(body.email);
      const nextDisplayName = readString(body.displayName);
      const correctionReason = readString(body.reason);
      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;
      if (!nextEmail && !nextDisplayName) {
        return jsonError(400, 'missing_profile_fields');
      }

      const encryptionConfig = parseFieldEncryptionConfigFromEnv(process.env);
      if (!encryptionConfig) {
        return jsonResponse(503, { error: 'encryption_not_configured' });
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          const account = await resolveAccountBySubject(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          if (!account) {
            return jsonResponse(404, { error: 'account_not_found' });
          }

          const emailCiphertext = nextEmail
            ? (() => {
                try {
                  return encryptFieldValue(
                    nextEmail,
                    encryptionConfig,
                    `iam.accounts.email:${user.id}`
                  );
                } catch {
                  return null;
                }
              })()
            : null;

          const displayNameCiphertext = nextDisplayName
            ? (() => {
                try {
                  return encryptFieldValue(
                    nextDisplayName,
                    encryptionConfig,
                    `iam.accounts.display_name:${user.id}`
                  );
                } catch {
                  return null;
                }
              })()
            : null;

          if ((nextEmail && !emailCiphertext) || (nextDisplayName && !displayNameCiphertext)) {
            return jsonResponse(500, { error: 'encryption_failed' });
          }

          return persistCorrection(client, {
            instanceId,
            account,
            emailCiphertext,
            displayNameCiphertext,
            correctionReason,
            nextEmail,
            nextDisplayName,
          });
        });
      } catch (error) {
        return handleJsonDatabaseError(
          'DSR profile correction failed',
          'profile_correction',
          instanceId,
          error
        );
      }
    });
  });
};

const persistCorrection = async (
  client: QueryClient,
  input: {
    instanceId: string;
    account: AccountSnapshot;
    emailCiphertext: string | null;
    displayNameCiphertext: string | null;
    correctionReason?: string;
    nextEmail?: string;
    nextDisplayName?: string;
  }
): Promise<Response> => {
  const {
    instanceId,
    account,
    emailCiphertext,
    displayNameCiphertext,
    correctionReason,
    nextEmail,
    nextDisplayName,
  } = input;
  await client.query(
    `
  UPDATE iam.accounts
  SET
    email_ciphertext = COALESCE($3, email_ciphertext),
    display_name_ciphertext = COALESCE($4, display_name_ciphertext),
    updated_at = NOW()
  WHERE id = $2::uuid;
  `,
    [instanceId, account.id, emailCiphertext, displayNameCiphertext]
  );

  await client.query(
    `
  INSERT INTO iam.account_profile_corrections (
    instance_id,
    account_id,
    actor_account_id,
    previous_email_ciphertext,
    previous_display_name_ciphertext,
    next_email_ciphertext,
    next_display_name_ciphertext,
    correction_reason
  )
  VALUES ($1, $2::uuid, $2::uuid, $3, $4, $5, $6, $7);
  `,
    [
      instanceId,
      account.id,
      account.email_ciphertext,
      account.display_name_ciphertext,
      emailCiphertext,
      displayNameCiphertext,
      correctionReason ?? null,
    ]
  );

  const requestId = await createDsrRequest(client, {
    instanceId,
    requestType: 'rectification',
    status: 'completed',
    requesterAccountId: account.id,
    targetAccountId: account.id,
    payload: {
      changed_fields: {
        email: Boolean(nextEmail),
        displayName: Boolean(nextDisplayName),
      },
    },
    completedAt: new Date().toISOString(),
  });

  await ensureArt19RecipientRows(client, { instanceId, requestId });
  await appendDsrRequestEvent(client, {
    instanceId,
    requestId,
    actorAccountId: account.id,
    eventType: 'profile_rectified',
    payload: {
      has_email_update: Boolean(nextEmail),
      has_display_name_update: Boolean(nextDisplayName),
    },
  });

  await emitDsrAuditEvent(client, {
    instanceId,
    accountId: account.id,
    eventType: 'dsr_profile_rectified',
    payload: {
      request_id: requestId,
      result: 'success',
    },
  });

  return jsonResponse(200, {
    status: 'ok',
    requestId,
  });
};
