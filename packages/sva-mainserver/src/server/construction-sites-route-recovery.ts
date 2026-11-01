import { z } from 'zod';
import { reserveIdempotency, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import {
  CONSTRUCTION_SITES_TYPE,
  type ConstructionSiteRecord,
} from './construction-sites-contract.js';
import { errorJson, isResponse, json } from './content-route-core.js';
import {
  authorizeConstructionSiteMedia,
  syncConstructionSiteMedia,
} from './construction-sites-route-access.js';
import {
  getSvaMainserverConstructionSite,
  recoverSvaMainserverConstructionSite,
} from './service.js';
import type { ConstructionSitePreparedWrite } from './service-internals/service-construction-sites.js';
import {
  authorizeMainserverCreateForPrincipal,
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  recordCreatedMainserverDataProvider,
  resolveMainserverVisibilityAction,
  toMainserverAdditionalActions,
  type MainserverMutationActor,
} from './mutation-principal.js';
const hex = z.string().regex(/^[a-f0-9]{64}$/);
export const endpoint = 'mainserver:construction-sites';
const preparedSchema = z
  .object({
    id: z.string().optional(),
    fingerprint: hex.optional(),
    providerId: z.string().optional(),
    previousMediaIds: z.array(z.string()),
    expected: z.record(z.string(), z.unknown()),
  })
  .strict();
export type Scope = Readonly<{
  instanceId: string;
  actorAccountId: string;
  idempotencyKey: string;
}>;

function mutationReply(
  data: ConstructionSiteRecord,
  operation: 'create' | 'update',
  partial = false
) {
  const response = json(
    {
      data: { ...data, ...(partial ? { reconciliationRequired: true } : {}) },
      meta: {
        operation,
        reconciliationStatus: partial ? 'reconciliation_required' : 'complete',
      },
    },
    partial ? 202 : operation === 'create' ? 201 : 200
  );
  response.headers.set('x-sva-mainserver-entity-id', data.id);
  return response;
}

export async function authorizeWrite(
  actor: MainserverMutationActor,
  prepared: ConstructionSitePreparedWrite
) {
  const action = prepared.id ? 'construction-sites.update' : 'construction-sites.create';
  if (!prepared.id)
    return authorizeMainserverCreateForPrincipal({
      actor,
      action,
      contentType: CONSTRUCTION_SITES_TYPE,
    });
  const current = await getSvaMainserverConstructionSite({ ...actor, siteId: prepared.id });
  return authorizeMainserverExistingContent({
    actor,
    action,
    contentType: CONSTRUCTION_SITES_TYPE,
    contentId: prepared.id,
    item: current.data,
    additionalActions: toMainserverAdditionalActions(
      resolveMainserverVisibilityAction(current.data.visible, prepared.expected.visible as boolean)
    ),
  });
}

export async function finish(
  actor: MainserverMutationActor,
  data: ConstructionSiteRecord,
  prepared: ConstructionSitePreparedWrite
) {
  let partial = false;
  try {
    if (!prepared.id) {
      const binding = await recordCreatedMainserverDataProvider({
        actor,
        created: data,
        reread: async () =>
          (await getSvaMainserverConstructionSite({ ...actor, siteId: data.id })).data,
        contentType: CONSTRUCTION_SITES_TYPE,
      });
      partial = binding.outcome === 'conflict' || binding.outcome === 'reconciliation_required';
    }
    await syncConstructionSiteMedia(actor, data, prepared.previousMediaIds);
    await finalizeMainserverMutation({
      actor,
      providerOutcome: 'succeeded',
      reconciliationStatus: partial ? 'reconciliation_required' : 'complete',
      completedSteps: ['provider_write', 'readback', 'media_references'],
      contentId: data.id,
      observedDataProviderId: data.dataProvider?.id,
    });
  } catch {
    partial = true;
    await finalizeMainserverMutation({
      actor,
      providerOutcome: 'succeeded',
      reconciliationStatus: 'reconciliation_required',
      completedSteps: ['provider_write', 'readback'],
      contentId: data.id,
      observedDataProviderId: data.dataProvider?.id,
      lastErrorCode: 'construction_site_follow_up_failed',
    }).catch(() => undefined);
  }
  return mutationReply(data, prepared.id ? 'update' : 'create', partial);
}

export async function recover(
  ctx: AuthenticatedRequestContext,
  actor: MainserverMutationActor,
  scope: Scope,
  hash: string,
  id?: string
) {
  const saved = await reserveIdempotency({
    ...scope,
    endpoint: `${endpoint}:expected`,
    payloadHash: hash,
  });
  if (saved.status !== 'replay')
    return errorJson(409, 'construction_site_outcome_unknown', 'construction_site_outcome_unknown');
  const prepared = preparedSchema.parse(saved.responseBody);
  if (prepared.id !== id)
    return errorJson(
      409,
      'construction_site_content_conflict',
      'construction_site_content_conflict'
    );
  const authorization = await authorizeWrite(actor, prepared);
  if (isResponse(authorization)) return authorization;
  const data = await recoverSvaMainserverConstructionSite({ ...actor, prepared });
  // Recovery rechecks resource access after resolving a newly created provider ID.
  const readAccess = await authorizeMainserverExistingContent({
    actor,
    action: 'construction-sites.read',
    contentType: CONSTRUCTION_SITES_TYPE,
    contentId: data.id,
    item: data,
  });
  if (isResponse(readAccess)) return readAccess;
  const media = await authorizeConstructionSiteMedia(
    ctx,
    data.input,
    prepared.previousMediaIds,
    data.id
  );
  if (isResponse(media)) return media;
  return finish(actor, data, prepared);
}
