import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { errorJson, isResponse, json } from './content-route-core.js';
import {
  authorizeMutation,
  contentTypeFor,
  pluginActionFor,
  type ContentKind,
} from './generic-items-route-access.js';
import { mergeFaqPayload, validateFaqWriteOrResponse } from './generic-items-route-faq.js';
import {
  mergeCockpitCardPayload,
  validateCockpitCardWriteOrResponse,
} from './generic-items-route-cockpit-cards.js';
import {
  parseGenericItemOrResponse,
  preserveCockpitCardIdentity,
  preserveEditorialAuthor,
} from './generic-items-route-write-input.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  runMainserverMutationWithFailureFinalization,
  resolveMainserverVisibilityAction,
  toMainserverAdditionalActions,
  type MainserverMutationActor,
} from './mutation-principal.js';
import {
  changeSvaMainserverGenericItemVisibility,
  getSvaMainserverGenericItem,
  updateSvaMainserverGenericItem,
} from './service.js';

const completeGenericItemUpdate = async (input: {
  actor: MainserverMutationActor;
  itemId: string;
  contentKind: ContentKind;
  requestedVisibility: boolean | undefined;
  existingItem: Awaited<ReturnType<typeof getSvaMainserverGenericItem>>;
  savedItem: Awaited<ReturnType<typeof updateSvaMainserverGenericItem>>;
}) => {
  const { actor, itemId, contentKind, requestedVisibility, existingItem } = input;
  const visibilityChanged =
    contentKind === 'cockpit-cards' &&
    typeof requestedVisibility === 'boolean' &&
    requestedVisibility !== existingItem.visible;
  let data = input.savedItem;
  if (visibilityChanged) {
    try {
      await changeSvaMainserverGenericItemVisibility({
        ...actor,
        genericItemId: itemId,
        visible: requestedVisibility,
      });
      data = await getSvaMainserverGenericItem({ ...actor, genericItemId: itemId });
      if (data.visible !== requestedVisibility) {
        throw new Error('mainserver_visibility_not_persisted');
      }
    } catch {
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'reconciliation_required',
        completedSteps: ['provider_write', 'projection_follow_up_deferred'],
        contentId: itemId,
        observedDataProviderId: existingItem.dataProvider?.id,
        lastErrorCode: 'mainserver_visibility_update_failed',
      });
      return errorJson(
        502,
        'visibility_update_failed',
        'Der Kachelinhalt wurde gespeichert, aber die Sichtbarkeit konnte nicht bestätigt werden.'
      );
    }
  }
  await finalizeMainserverMutation({
    actor,
    providerOutcome: 'succeeded',
    reconciliationStatus: 'complete',
    completedSteps: visibilityChanged ? ['provider_write', 'visibility_write'] : ['provider_write'],
    contentId: itemId,
    observedDataProviderId: existingItem.dataProvider?.id,
  });
  return data;
};

export const handleUpdateRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  requestId: string | undefined,
  itemId: string,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, contentKind, 'update', requestId, itemId);
  if (isResponse(actor)) {
    return actor;
  }

  return runMainserverMutationWithFailureFinalization({
    actor,
    contentId: itemId,
    operation: async () => {
      const existingItem = await getSvaMainserverGenericItem({ ...actor, genericItemId: itemId });
      if (contentKind === 'faq' && existingItem && existingItem.genericType !== 'FAQ') {
        return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
      }
      if (
        contentKind === 'cockpit-cards' &&
        existingItem &&
        existingItem.genericType !== 'COCKPIT_CARD'
      )
        return errorJson(404, 'not_found', 'Kachel wurde nicht gefunden.');
      const genericItem =
        contentKind === 'faq'
          ? await validateFaqWriteOrResponse(request)
          : contentKind === 'cockpit-cards'
            ? await validateCockpitCardWriteOrResponse(request)
            : await parseGenericItemOrResponse(request);
      if (isResponse(genericItem)) return genericItem;
      if (contentKind === 'faq' && !existingItem)
        return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
      if (contentKind === 'cockpit-cards' && !existingItem)
        return errorJson(404, 'not_found', 'Kachel wurde nicht gefunden.');
      const providerAuthorization = await authorizeMainserverExistingContent({
        actor,
        action: pluginActionFor(contentKind, 'update'),
        contentType: contentTypeFor(contentKind),
        contentId: itemId,
        item: existingItem,
        additionalActions: existingItem
          ? toMainserverAdditionalActions(
              resolveMainserverVisibilityAction(existingItem.visible, genericItem.visible)
            )
          : [],
      });
      if (isResponse(providerAuthorization)) return providerAuthorization;
      const data = await updateSvaMainserverGenericItem({
        ...actor,
        genericItemId: itemId,
        genericItem:
          contentKind === 'faq'
            ? {
                ...preserveEditorialAuthor(genericItem, existingItem),
                genericType: 'FAQ',
                payload: mergeFaqPayload(existingItem?.payload, genericItem.payload),
              }
            : contentKind === 'cockpit-cards'
              ? {
                  ...preserveCockpitCardIdentity(genericItem, existingItem),
                  genericType: 'COCKPIT_CARD',
                  payload: mergeCockpitCardPayload(existingItem?.payload, genericItem.payload),
                }
              : preserveEditorialAuthor(genericItem, existingItem),
      });
      const completed = await completeGenericItemUpdate({
        actor,
        itemId,
        contentKind,
        requestedVisibility: genericItem.visible,
        existingItem,
        savedItem: data,
      });
      if (isResponse(completed)) return completed;
      logSuccess('mainserver_generic-items_update', itemId);
      return json({ data: completed });
    },
  });
};
