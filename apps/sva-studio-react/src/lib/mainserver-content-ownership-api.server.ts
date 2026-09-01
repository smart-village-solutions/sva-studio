import {
  finalizeMainserverMutationJournal,
  loadRecoverableMainserverOwnershipTransfers,
  markMainserverMutationReconciliationRequired,
  resolveMainserverOwnershipTarget,
  type RecoverableMainserverOwnershipTransfer,
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

type MutationFollowUpContext = NonNullable<
  ReturnType<typeof readMainserverMutationFollowUpContext>
>;

const toContentTransferErrorCode = (code: string): string =>
  code.startsWith('content_transfer_') ? code : `content_transfer_${code}`;

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

const readContentId = (request: Request): string | undefined => {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  const ownershipIndex = segments.findIndex((segment) => segment === 'content-ownership');
  const encoded = ownershipIndex >= 0 ? segments[ownershipIndex + 2] : undefined;
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
};

const refreshTransferredOwnershipProjection = async (input: {
  readonly followUp: MutationFollowUpContext;
  readonly contentType: ProjectionContentType;
  readonly contentId: string;
  readonly providerEntityId: string;
  readonly operationExternalId: string;
  readonly expectedDataProviderId: string;
  readonly principal: RecoverableMainserverOwnershipTransfer['targetPrincipal'];
}): Promise<void> => {
  const target = await resolveMainserverOwnershipTarget({
    instanceId: input.followUp.instanceId,
    actorKeycloakSubject: input.followUp.keycloakSubject,
    principal: input.principal,
  });
  if (!target.ok) throw new Error(toContentTransferErrorCode(target.code));
  if (target.target.dataProviderId !== input.expectedDataProviderId) {
    throw new Error('content_transfer_target_binding_changed');
  }
  await refreshProjectedContentsForMainserverMutation({
    instanceId: input.followUp.instanceId,
    keycloakSubject: target.target.connection.keycloakSubject,
    actorAccountId:
      input.principal.type === 'account' ? input.principal.id : input.followUp.actorAccountId,
    auditActorAccountId: input.followUp.actorAccountId,
    actorDisplayName: input.followUp.actorDisplayName,
    ownershipPrincipal: input.principal,
    mutationRef: input.operationExternalId,
    contentType: input.contentType,
    ...(input.principal.type === 'organization' ? { organizationId: input.principal.id } : {}),
    actingPrincipalType: target.target.connection.actingPrincipalType,
    credentialFingerprint: target.target.connection.credentialFingerprint,
    authorizationMode: 'exact',
    operation: 'update',
    entityId: input.providerEntityId,
  });
  await finalizeMainserverMutationJournal({
    instanceId: input.followUp.instanceId,
    operationExternalId: input.operationExternalId,
    providerOutcome: 'succeeded',
    reconciliationStatus: 'complete',
    completedSteps: ['target_projection_refreshed'],
    contentId: input.contentId,
  });
};

export const dispatchMainserverContentOwnershipRequest = async (
  request: Request
): Promise<Response | null> => {
  const contentType = readContentType(request);
  const response = await dispatchSvaMainserverContentOwnershipRequest(request, {
    ...(contentType
      ? {
          reconcilePreviousTransfer: async (input: {
            readonly instanceId: string;
            readonly contentId: string;
            readonly providerEntityId: string;
            readonly currentDataProviderId: string;
          }) => {
            const reconciliationFollowUp = readMainserverMutationFollowUpContext(request);
            if (!reconciliationFollowUp) {
              throw new Error('content_transfer_follow_up_context_missing');
            }
            if (input.instanceId !== reconciliationFollowUp.instanceId) {
              throw new Error('content_transfer_reconciliation_instance_mismatch');
            }
            const recoverable = await loadRecoverableMainserverOwnershipTransfers({
              instanceId: input.instanceId,
              contentType,
              contentId: input.contentId,
              currentDataProviderId: input.currentDataProviderId,
            });
            for (const entry of recoverable) {
              await refreshTransferredOwnershipProjection({
                followUp: reconciliationFollowUp,
                contentType,
                contentId: input.contentId,
                providerEntityId: input.providerEntityId,
                operationExternalId: entry.operationExternalId,
                expectedDataProviderId: entry.expectedDataProviderId,
                principal: entry.targetPrincipal,
              });
            }
          },
        }
      : {}),
  });
  const followUp = readMainserverMutationFollowUpContext(request);
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
          targetDataProvider?: Readonly<{ id?: string; name?: string }>;
        }>;
      };
      const principal = payload.data?.targetPrincipal;
      const providerEntityId = payload.data?.contentId;
      const contentId = readContentId(request);
      const expectedDataProviderId = payload.data?.targetDataProvider?.id;
      if (!followUp) throw new Error('content_transfer_follow_up_context_missing');
      if (
        !contentId ||
        !providerEntityId ||
        !expectedDataProviderId ||
        !principal?.id ||
        (principal.type !== 'account' && principal.type !== 'organization')
      ) {
        throw new Error('content_transfer_response_invalid');
      }
      await refreshTransferredOwnershipProjection({
        followUp,
        contentType,
        contentId,
        providerEntityId,
        operationExternalId: followUp.operationExternalId,
        expectedDataProviderId,
        principal: { type: principal.type, id: principal.id },
      });
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
