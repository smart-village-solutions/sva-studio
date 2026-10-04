import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { errorJson, isResponse, json, parseDetachLinkedContent } from './content-route-core.js';
import {
  authorizeMutation,
  contentTypeFor,
  pluginActionFor,
  type ContentKind,
} from './generic-items-route-access.js';
import { validateFaqWriteOrResponse } from './generic-items-route-faq.js';
import { validateCockpitCardWriteOrResponse } from './generic-items-route-cockpit-cards.js';
import {
  parseGenericItemOrResponse,
  preserveCockpitCardIdentity,
  withoutEditorialAuthor,
} from './generic-items-route-write-input.js';
import {
  authorizeMainserverCreateForPrincipal,
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  recordCreatedMainserverDataProvider,
  runMainserverMutationWithFailureFinalization,
} from './mutation-principal.js';
import {
  createSvaMainserverGenericItem,
  deleteSvaMainserverGenericItem,
  getSvaMainserverGenericItem,
} from './service.js';

export const handleCreateRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, contentKind, 'create', requestId);
  if (isResponse(actor)) {
    return actor;
  }

  return runMainserverMutationWithFailureFinalization({
    actor,
    operation: async () => {
      const genericItem =
        contentKind === 'faq'
          ? await validateFaqWriteOrResponse(request)
          : contentKind === 'cockpit-cards'
            ? await validateCockpitCardWriteOrResponse(request)
            : await parseGenericItemOrResponse(request);
      if (isResponse(genericItem)) return genericItem;

      const principalAuthorization = await authorizeMainserverCreateForPrincipal({
        actor,
        action: pluginActionFor(contentKind, 'create'),
        contentType: contentTypeFor(contentKind),
      });
      if (isResponse(principalAuthorization)) return principalAuthorization;

      const data = await createSvaMainserverGenericItem({
        ...actor,
        genericItem:
          contentKind === 'faq'
            ? { ...withoutEditorialAuthor(genericItem), genericType: 'FAQ' }
            : contentKind === 'cockpit-cards'
              ? { ...preserveCockpitCardIdentity(genericItem, null), genericType: 'COCKPIT_CARD' }
              : withoutEditorialAuthor(genericItem),
      });
      const bindingResult = await recordCreatedMainserverDataProvider({
        actor,
        created: data,
        reread: async () => await getSvaMainserverGenericItem({ ...actor, genericItemId: data.id }),
        contentType: contentTypeFor(contentKind),
      });
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus:
          bindingResult.outcome === 'conflict' ||
          bindingResult.outcome === 'reconciliation_required'
            ? 'reconciliation_required'
            : 'complete',
        completedSteps: ['provider_write', 'binding_observation'],
        contentId: data.id,
        observedDataProviderId: data.dataProvider?.id ?? bindingResult.observedDataProviderId,
      });
      logSuccess('mainserver_generic-items_create', data.id);
      return json(
        {
          data,
          ...(bindingResult.outcome === 'conflict' ||
          bindingResult.outcome === 'reconciliation_required'
            ? { meta: { reconciliationStatus: 'reconciliation_required' } }
            : {}),
        },
        201
      );
    },
  });
};

export const handleDeleteRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  requestId: string | undefined,
  itemId: string,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const detachLinkedContent = parseDetachLinkedContent(request);
  if (isResponse(detachLinkedContent)) return detachLinkedContent;
  const actor = await authorizeMutation(request, ctx, contentKind, 'delete', requestId, itemId);
  if (isResponse(actor)) {
    return actor;
  }

  return runMainserverMutationWithFailureFinalization({
    actor,
    contentId: itemId,
    operation: async () => {
      const existingItem = await getSvaMainserverGenericItem({ ...actor, genericItemId: itemId });
      if (contentKind === 'faq' && existingItem?.genericType !== 'FAQ') {
        return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
      }
      if (contentKind === 'cockpit-cards' && existingItem?.genericType !== 'COCKPIT_CARD')
        return errorJson(404, 'not_found', 'Kachel wurde nicht gefunden.');
      const providerAuthorization = await authorizeMainserverExistingContent({
        actor,
        action: pluginActionFor(contentKind, 'delete'),
        contentType: contentTypeFor(contentKind),
        contentId: itemId,
        item: existingItem,
      });
      if (isResponse(providerAuthorization)) return providerAuthorization;
      const data = await deleteSvaMainserverGenericItem({
        ...actor,
        genericItemId: itemId,
        detachLinkedContent,
      });
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write', 'tombstone'],
        contentId: itemId,
        observedDataProviderId: existingItem?.dataProvider?.id,
      });
      logSuccess('mainserver_generic-items_delete', itemId);
      return json({ data });
    },
  });
};
