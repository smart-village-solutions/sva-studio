import { emitAuthAuditEvent } from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type {
  MainserverMutationActor,
  MainserverMutationAuthorization,
} from './mutation-principal-types.js';

const logger = createSdkLogger({ component: 'sva-mainserver-mutation-principal', level: 'info' });

type AuthorizationAuditInput = Readonly<{
  actor: MainserverMutationActor;
  action: string;
  contentType: string;
  contentId?: string;
  dataProviderId?: string;
  authorizationMode: MainserverMutationAuthorization['authorizationMode'];
  resolverMode?: MainserverMutationAuthorization['resolverMode'];
  candidateAuthorizationMode?: MainserverMutationAuthorization['candidateAuthorizationMode'];
  candidateAllowed?: boolean;
  shadowDifference?: boolean;
  allowed: boolean;
  reasonCode?: string;
}>;

export const emitMainserverMutationAuthorizationAudit = async (
  input: AuthorizationAuditInput
): Promise<void> => {
  const actionNamespace = input.action.split('.')[0] ?? 'content';
  const workspaceContext = getWorkspaceContext();
  try {
    await emitAuthAuditEvent({
      eventType: input.allowed ? 'plugin_action_authorized' : 'plugin_action_denied',
      actorUserId: input.actor.keycloakSubject,
      scope: { kind: 'instance', instanceId: input.actor.instanceId },
      workspaceId: input.actor.instanceId,
      outcome: input.allowed ? 'success' : 'denied',
      requestId: workspaceContext.requestId,
      traceId: workspaceContext.traceId,
      pluginAction: {
        actionId: input.action,
        actionNamespace,
        actionOwner: 'sva-mainserver',
        result: input.allowed ? 'success' : 'denied',
        reasonCode: input.reasonCode,
        resourceType: input.contentType,
        resourceId: input.contentId,
        mainserverMutation: {
          actingPrincipalType: input.actor.mutationPrincipalContext.actingPrincipalType,
          actingPrincipalId: input.actor.mutationPrincipalContext.actingPrincipalId,
          activeOrganizationId: input.actor.activeOrganizationId,
          credentialSource: input.actor.mutationPrincipalContext.credentialSource,
          credentialFingerprint: input.actor.mutationPrincipalContext.credentialFingerprint,
          dataProviderId: input.dataProviderId,
          authorizationMode: input.authorizationMode,
          resolverMode: input.resolverMode,
          candidateAuthorizationMode: input.candidateAuthorizationMode,
          candidateAllowed: input.candidateAllowed,
          shadowDifference: input.shadowDifference,
          operationExternalId: input.actor.operationExternalId,
        },
      },
    });
  } catch (error) {
    logger.warn('Failed to emit Mainserver authorization audit', {
      operation: 'mainserver_authorization_audit',
      instance_id: input.actor.instanceId,
      operation_external_id: input.actor.operationExternalId,
      action_id: input.action,
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
};
