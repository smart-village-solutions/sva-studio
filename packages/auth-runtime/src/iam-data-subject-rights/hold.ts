import { withRequestContext } from '@sva/server-runtime';
import { emitDsrAuditEvent } from '@sva/iam-governance/dsr-persistence';
import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse } from '../db.js';
import { readString } from '../shared/input-readers.js';
import {
  DSR_WRITE_ACTION,
  authorizeDsrJsonAction,
  handleJsonDatabaseError,
  jsonError,
  requireJsonBody,
  resolveJsonScopedInstance,
  withInstanceScopedDb,
} from './shared.js';
import { resolveAccountBySubject, resolveRequesterAccountId } from './persistence.js';

export const legalHoldApplyHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const authorizationError = await authorizeDsrJsonAction(ctx, DSR_WRITE_ACTION);
      if (authorizationError) {
        return authorizationError;
      }
      const { user } = ctx;

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
      const targetSubject = readString(body.targetKeycloakSubject);
      const holdReason = readString(body.holdReason) ?? 'legal_hold';
      const holdUntil = readString(body.holdUntil);

      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;
      if (!targetSubject) {
        return jsonError(400, 'missing_target_keycloak_subject');
      }
      if (holdUntil && Number.isNaN(Date.parse(holdUntil))) {
        return jsonError(400, 'invalid_hold_until');
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          const target = await resolveAccountBySubject(client, {
            instanceId,
            keycloakSubject: targetSubject,
          });
          if (!target) {
            return jsonResponse(404, { error: 'target_account_not_found' });
          }

          const actor = await resolveRequesterAccountId(client, {
            instanceId,
            keycloakSubject: user.id,
          });

          const inserted = await client.query<{ id: string }>(
            `
INSERT INTO iam.legal_holds (
  instance_id,
  account_id,
  active,
  hold_reason,
  hold_until,
  created_by_account_id
)
VALUES ($1, $2::uuid, true, $3, $4::timestamptz, $5::uuid)
RETURNING id;
`,
            [instanceId, target.id, holdReason, holdUntil ?? null, actor ?? null]
          );

          await emitDsrAuditEvent(client, {
            instanceId,
            accountId: actor,
            eventType: 'dsr_legal_hold_applied',
            payload: {
              target_subject: targetSubject,
              legal_hold_id: inserted.rows[0]!.id,
              hold_until: holdUntil ?? null,
              result: 'success',
            },
          });

          return jsonResponse(200, {
            legalHoldId: inserted.rows[0]!.id,
            status: 'active',
          });
        });
      } catch (error) {
        return handleJsonDatabaseError(
          'Legal hold apply failed',
          'legal_hold_apply',
          instanceId,
          error
        );
      }
    });
  });
};

export const legalHoldReleaseHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const authorizationError = await authorizeDsrJsonAction(ctx, DSR_WRITE_ACTION);
      if (authorizationError) {
        return authorizationError;
      }
      const { user } = ctx;

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
      const targetSubject = readString(body.targetKeycloakSubject);
      const releaseReason = readString(body.releaseReason) ?? 'hold_released';

      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;
      if (!targetSubject) {
        return jsonError(400, 'missing_target_keycloak_subject');
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          const target = await resolveAccountBySubject(client, {
            instanceId,
            keycloakSubject: targetSubject,
          });
          if (!target) {
            return jsonResponse(404, { error: 'target_account_not_found' });
          }

          const actor = await resolveRequesterAccountId(client, {
            instanceId,
            keycloakSubject: user.id,
          });

          const released = await client.query<{ id: string }>(
            `
UPDATE iam.legal_holds
SET
  active = false,
  lifted_reason = $3,
  lifted_by_account_id = $4::uuid,
  lifted_at = NOW()
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND active = true
RETURNING id;
`,
            [instanceId, target.id, releaseReason, actor ?? null]
          );

          await emitDsrAuditEvent(client, {
            instanceId,
            accountId: actor,
            eventType: 'dsr_legal_hold_released',
            payload: {
              target_subject: targetSubject,
              released_count: released.rowCount,
              result: 'success',
            },
          });

          return jsonResponse(200, {
            releasedCount: released.rowCount,
          });
        });
      } catch (error) {
        return handleJsonDatabaseError(
          'Legal hold release failed',
          'legal_hold_release',
          instanceId,
          error
        );
      }
    });
  });
};
