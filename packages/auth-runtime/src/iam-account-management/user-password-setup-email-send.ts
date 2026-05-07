import type { AuthenticatedRequestContext } from '../middleware.js';
import { resolveAuthConfigForInstance } from '../config.js';

import { ensureActorCanManageTarget, resolveActorMaxRoleLevel } from './shared-actor-authorization.js';
import { emitActivityLog } from './shared-activity.js';
import { trackKeycloakCall, withInstanceScopedDb } from './shared.js';
import { resolveUserDetail } from './user-detail-query.js';
import {
  buildErrorResponseBody,
  buildKeycloakUnavailableResponse,
  buildPasswordSetupEmailFailureResponse,
  buildRequestResponseBody,
  emitPasswordSetupEmailFailureAudit,
  type ExecuteActionsEmail,
  finalizePasswordSetupEmailError,
  finalizePasswordSetupEmailResponse,
  logSendPasswordSetupEmailFailure,
  type PasswordSetupEmailActor,
  type SendPasswordSetupEmailDependencies,
} from './user-password-setup-email-shared.js';

type SendPasswordSetupEmailResult = {
  readonly status: 'sent';
};

type ManageTargetFailure = {
  ok: false;
  code: string;
  message: string;
};

type PasswordSetupTargetUser = NonNullable<Awaited<ReturnType<typeof resolveUserDetail>>>;

type ResolvedTargetUser =
  | { kind: 'not_found' }
  | { kind: 'forbidden'; failure: ManageTargetFailure }
  | {
      kind: 'ok';
      user: PasswordSetupTargetUser;
    };

const resolveTargetUserForPasswordSetupEmail = async (input: {
  actor: PasswordSetupEmailActor;
  ctx: AuthenticatedRequestContext;
  userId: string;
}): Promise<ResolvedTargetUser> =>
  withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const detail = await resolveUserDetail(client, {
      instanceId: input.actor.instanceId,
      userId: input.userId,
    });
    if (!detail) {
      return { kind: 'not_found' };
    }

    const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.ctx.user.id,
      sessionRoleNames: input.ctx.user.roles,
    });
    const targetAccess = ensureActorCanManageTarget({
      actorMaxRoleLevel,
      actorRoles: input.ctx.user.roles,
      targetRoles: detail.roles,
    });
    if (!targetAccess.ok) {
      return {
        kind: 'forbidden',
        failure: targetAccess,
      };
    }

    return {
      kind: 'ok',
      user: detail,
    };
  });

const finalizeTargetUserResolution = async (
  resolvedTargetUser: ResolvedTargetUser,
  input: SendPasswordSetupEmailDependencies
) => {
  if (resolvedTargetUser.kind === 'ok') {
    return null;
  }

  if (resolvedTargetUser.kind === 'not_found') {
    return finalizePasswordSetupEmailError({
      ...input,
      responseStatus: 404,
      responseBody: buildErrorResponseBody({
        code: 'not_found',
        message: 'Nutzer nicht gefunden.',
        requestId: input.actor.requestId,
      }),
    });
  }

  return finalizePasswordSetupEmailError({
    ...input,
    responseStatus: 403,
    responseBody: buildErrorResponseBody({
      code: resolvedTargetUser.failure.code,
      message: resolvedTargetUser.failure.message,
      requestId: input.actor.requestId,
    }),
  });
};

const resolveExecuteActionsEmail = async (
  input: SendPasswordSetupEmailDependencies & {
    executeActionsEmail: ExecuteActionsEmail | undefined;
  }
) => {
  if (input.executeActionsEmail) {
    return input.executeActionsEmail;
  }

  const response = buildKeycloakUnavailableResponse(input.actor.requestId);
  const responseBody = await response.clone().json();
  return finalizePasswordSetupEmailError({
    ...input,
    responseStatus: response.status,
    responseBody,
  });
};

const emitPasswordSetupEmailSuccessAudit = async (input: {
  actor: PasswordSetupEmailActor;
  user: PasswordSetupTargetUser;
}) =>
  withInstanceScopedDb(input.actor.instanceId, (client) =>
    emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      subjectId: input.user.id,
      eventType: 'user.password_setup_email_sent',
      result: 'success',
      payload: {
        operation: 'send_password_setup_email',
        keycloak_subject: input.user.keycloakSubject,
      },
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    })
  );

const sendPasswordSetupEmail = async (input: {
  actor: PasswordSetupEmailActor;
  executeActionsEmail: ExecuteActionsEmail;
  user: PasswordSetupTargetUser;
}) => {
  const authConfig = await resolveAuthConfigForInstance(input.actor.instanceId);
  await trackKeycloakCall('send_password_setup_email', () =>
    input.executeActionsEmail(input.user.keycloakSubject, {
      actions: ['UPDATE_PASSWORD'],
      clientId: authConfig.clientId,
      redirectUri: authConfig.postLogoutRedirectUri,
    })
  );
};

const completePasswordSetupEmailSuccess = async (
  input: SendPasswordSetupEmailDependencies & { actor: PasswordSetupEmailActor }
) =>
  finalizePasswordSetupEmailResponse({
    ...input,
    status: 'COMPLETED',
    responseStatus: 200,
    responseBody: buildRequestResponseBody(
      {
        status: 'sent',
      } satisfies SendPasswordSetupEmailResult,
      input.actor.requestId
    ),
    result: 'success',
  });

export const processPasswordSetupEmailSend = async (input: {
  actor: PasswordSetupEmailActor;
  ctx: AuthenticatedRequestContext;
  endpoint: string;
  executeActionsEmail: ExecuteActionsEmail | undefined;
  idempotencyKey: string;
  userId: string;
}): Promise<Response> => {
  const completionContext = {
    actor: input.actor,
    endpoint: input.endpoint,
    idempotencyKey: input.idempotencyKey,
  } satisfies SendPasswordSetupEmailDependencies;

  try {
    const resolvedTargetUser = await resolveTargetUserForPasswordSetupEmail({
      actor: input.actor,
      ctx: input.ctx,
      userId: input.userId,
    });
    const targetResolutionResponse = await finalizeTargetUserResolution(
      resolvedTargetUser,
      completionContext
    );
    if (targetResolutionResponse) {
      return targetResolutionResponse;
    }

    const executeActionsEmail = await resolveExecuteActionsEmail({
      ...completionContext,
      executeActionsEmail: input.executeActionsEmail,
    });
    if (executeActionsEmail instanceof Response) {
      return executeActionsEmail;
    }
    if (resolvedTargetUser.kind !== 'ok') {
      throw new Error('password_setup_email_target_resolution_invariant_failed');
    }

    await sendPasswordSetupEmail({
      actor: input.actor,
      executeActionsEmail,
      user: resolvedTargetUser.user,
    });
    await emitPasswordSetupEmailSuccessAudit({
      actor: input.actor,
      user: resolvedTargetUser.user,
    });
    return completePasswordSetupEmailSuccess(completionContext);
  } catch (error) {
    logSendPasswordSetupEmailFailure({
      actor: input.actor,
      error,
    });
    await emitPasswordSetupEmailFailureAudit({
      actor: input.actor,
      userId: input.userId,
      error,
    });

    const response = buildPasswordSetupEmailFailureResponse(error, input.actor.requestId);
    const responseBody = await response.clone().json();
    return finalizePasswordSetupEmailError({
      ...completionContext,
      responseStatus: response.status,
      responseBody,
    });
  }
};
