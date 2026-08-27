import {
  finalizeMainserverMutationJournal,
  markMainserverMutationReconciliationRequired,
  resolveMainserverOwnershipTarget,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';
import {
  dispatchSvaMainserverContentOwnershipRequest,
  readMainserverMutationFollowUpContext,
} from '@sva/sva-mainserver/server';

import { refreshProjectedContentsForMainserverMutation } from './iam-content-list-projection.server.js';
import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server.js';

type ProjectionContentType = Parameters<typeof refreshProjectionAfterMainserverMutation>[2];

const supportedContentTypes = new Set<ProjectionContentType>([
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
  'generic-items.generic-item',
  'faq.faq',
  'cockpit-cards.cockpit-card',
  'projects.project',
  'surveys.survey',
]);
const logger = createSdkLogger({ component: 'mainserver-content-ownership-api', level: 'info' });

const readContentType = (request: Request): ProjectionContentType | undefined => {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  const ownershipIndex = segments.findIndex((segment) => segment === 'content-ownership');
  const encoded = ownershipIndex >= 0 ? segments[ownershipIndex + 1] : undefined;
  if (!encoded) return undefined;
  let contentType: string;
  try {
    contentType = decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
  return supportedContentTypes.has(contentType as ProjectionContentType)
    ? (contentType as ProjectionContentType)
    : undefined;
};

export const dispatchMainserverContentOwnershipRequest = async (
  request: Request
): Promise<Response | null> => {
  const response = await dispatchSvaMainserverContentOwnershipRequest(request);
  const contentType = response ? readContentType(request) : undefined;
  const isConfirmedTransfer =
    response?.ok === true &&
    request.method === 'POST' &&
    new URL(request.url).pathname.endsWith('/transfer');
  if (response && contentType && !isConfirmedTransfer) {
    await refreshProjectionAfterMainserverMutation(request, response, contentType);
  }
  if (response && contentType && isConfirmedTransfer) {
    const followUp = readMainserverMutationFollowUpContext(request);
    try {
      const payload = (await response.clone().json()) as {
        readonly data?: Readonly<{
          contentId?: string;
          targetPrincipal?: Readonly<{ type?: string; id?: string }>;
          targetDataProvider?: Readonly<{ name?: string }>;
        }>;
      };
      const principal = payload.data?.targetPrincipal;
      const contentId = payload.data?.contentId;
      if (!followUp) throw new Error('content_transfer_follow_up_context_missing');
      if (
        !contentId ||
        !principal?.id ||
        (principal.type !== 'account' && principal.type !== 'organization')
      ) {
        throw new Error('content_transfer_response_invalid');
      }
      {
        const target = await resolveMainserverOwnershipTarget({
          instanceId: followUp.instanceId,
          actorKeycloakSubject: followUp.keycloakSubject,
          principal: { type: principal.type, id: principal.id },
        });
        if (!target.ok) throw new Error(target.code);
        await refreshProjectedContentsForMainserverMutation({
          instanceId: followUp.instanceId,
          keycloakSubject: target.target.connection.keycloakSubject,
          actorAccountId: principal.type === 'account' ? principal.id : followUp.actorAccountId,
          auditActorAccountId: followUp.actorAccountId,
          actorDisplayName: followUp.actorDisplayName,
          ownershipPrincipal: { type: principal.type, id: principal.id },
          mutationRef: followUp.operationExternalId,
          contentType,
          ...(principal.type === 'organization' ? { organizationId: principal.id } : {}),
          actingPrincipalType: target.target.connection.actingPrincipalType,
          credentialFingerprint: target.target.connection.credentialFingerprint,
          authorizationMode: 'exact',
          operation: 'update',
          entityId: contentId,
        });
        await finalizeMainserverMutationJournal({
          instanceId: followUp.instanceId,
          operationExternalId: followUp.operationExternalId,
          providerOutcome: 'succeeded',
          reconciliationStatus: 'complete',
          completedSteps: ['target_projection_refreshed'],
          contentId,
        });
      }
    } catch (error) {
      if (followUp) {
        await markMainserverMutationReconciliationRequired({
          instanceId: followUp.instanceId,
          operationExternalId: followUp.operationExternalId,
          completedStep: 'target_projection_refresh_failed',
          lastErrorCode: 'content_transfer_projection_refresh_failed',
        }).catch(() => undefined);
      }
      logger.warn('Target projection refresh failed after confirmed ownership transfer', {
        operation: 'content_ownership_target_projection_refresh',
        content_type: contentType,
        error_code: error instanceof Error ? error.name : 'unknown_error',
      });
    }
  }
  return response;
};
