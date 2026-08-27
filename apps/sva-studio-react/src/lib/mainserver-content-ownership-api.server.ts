import { resolveMainserverOwnershipTarget } from '@sva/auth-runtime/server';
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
    try {
      const payload = (await response.clone().json()) as {
        readonly data?: Readonly<{
          contentId?: string;
          targetPrincipal?: Readonly<{ type?: string; id?: string }>;
          targetDataProvider?: Readonly<{ name?: string }>;
        }>;
      };
      const followUp = readMainserverMutationFollowUpContext(request);
      const principal = payload.data?.targetPrincipal;
      const contentId = payload.data?.contentId;
      if (
        followUp &&
        contentId &&
        principal?.id &&
        (principal.type === 'account' || principal.type === 'organization')
      ) {
        const target = await resolveMainserverOwnershipTarget({
          instanceId: followUp.instanceId,
          actorKeycloakSubject: followUp.keycloakSubject,
          principal: { type: principal.type, id: principal.id },
        });
        if (target.ok) {
          await refreshProjectedContentsForMainserverMutation({
            instanceId: followUp.instanceId,
            keycloakSubject: target.target.connection.keycloakSubject,
            actorAccountId: principal.type === 'account' ? principal.id : followUp.actorAccountId,
            actorDisplayName:
              payload.data?.targetDataProvider?.name ?? target.target.dataProviderName,
            mutationRef: followUp.operationExternalId,
            contentType,
            ...(principal.type === 'organization' ? { organizationId: principal.id } : {}),
            actingPrincipalType: target.target.connection.actingPrincipalType,
            credentialFingerprint: target.target.connection.credentialFingerprint,
            authorizationMode: 'exact',
            operation: 'update',
            entityId: contentId,
          });
        }
      }
    } catch (error) {
      logger.warn('Target projection refresh failed after confirmed ownership transfer', {
        operation: 'content_ownership_target_projection_refresh',
        content_type: contentType,
        error_code: error instanceof Error ? error.name : 'unknown_error',
      });
    }
  }
  return response;
};
