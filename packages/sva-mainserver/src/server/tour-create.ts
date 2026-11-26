import { createHash } from 'node:crypto';
import { completeIdempotency, reserveIdempotency } from '@sva/auth-runtime/server';
import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';
import { z } from 'zod';

import { errorJson, isResponse, json } from './content-route-core.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  authorizeMainserverCreateForPrincipal,
  finalizeMainserverMutation,
  finalizeMainserverMutationFailure,
  recordCreatedMainserverDataProvider,
  type MainserverMutationActor,
} from './mutation-principal.js';
import type { ServiceContext } from './service-internals/service-context.js';
import { toSvaMainserverError } from './service-internals/shared.js';
import type { createTourReads } from './tour-reads.js';

const endpoint = 'POST:/api/v1/mainserver/tours';
const contentType = 'tours.tour';
const text = z.string().trim().min(1).max(250);
const coordinates = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const description = z.string().max(100_000).transform(sanitizeRichTextHtml);
const httpsUrl = z.url({ protocol: /^https$/ });
const draftInput = z.strictObject({
  name: text,
  lengthKm: z.number().int().min(0).max(2_147_483_647),
  visible: z.literal(false),
  description: description.optional(),
  categories: z
    .array(z.object({ id: text }))
    .max(100)
    .optional(),
  addresses: z
    .array(z.object({ street: text.optional(), city: text.optional(), zip: text.optional() }))
    .max(1)
    .optional(),
  contact: z.object({ email: z.email().optional(), phone: text.optional() }).optional(),
  operatingCompany: z.object({ name: text }).optional(),
  mediaContents: z
    .array(
      z.object({
        contentType: z.literal('image'),
        sourceUrl: z.object({ url: httpsUrl }),
        captionText: text.optional(),
        copyright: text.optional(),
      })
    )
    .max(20)
    .optional(),
  geometryTourData: z.array(coordinates).min(2).max(10_000).optional(),
  tourStops: z
    .array(
      z.object({
        name: text,
        description: description.optional(),
        location: z.object({ geoLocation: coordinates }).optional(),
      })
    )
    .max(200)
    .optional(),
});

export const createTourDraftDocument = `
  mutation SvaMainserverCreateTourDraft(
    $visible: Boolean!, $name: String!, $lengthKm: Int!, $description: String,
    $categories: [CategoryInput!], $addresses: [AddressInput!], $contact: ContactInput,
    $operatingCompany: OperatingCompanyInput, $mediaContents: [MediaContentInput!],
    $geometryTourData: [GeoLocationInput!], $tourStops: [TourStopInput!]
  ) {
    createTour(forceCreate: true, visible: $visible, name: $name, lengthKm: $lengthKm,
      description: $description, categories: $categories, addresses: $addresses, contact: $contact,
      operatingCompany: $operatingCompany, mediaContents: $mediaContents,
      geometryTourData: $geometryTourData, tourStops: $tourStops) {
      id visible dataProvider { id name }
    }
  }
`;

const createResponse = z.object({
  createTour: z.object({
    id: z.string().min(1),
    visible: z.boolean().nullish(),
    dataProvider: z
      .object({
        id: z.string().min(1),
        name: z
          .string()
          .nullish()
          .transform((name) => name ?? undefined),
      })
      .nullish(),
  }),
});

type Draft = z.output<typeof draftInput>;
type TourCreateContext = Pick<
  ServiceContext,
  'loadValidatedInstanceConfig' | 'loadDataProviderIdentityWithConfig' | 'executeGraphqlWithConfig'
>;

const persistDraft = async (
  context: TourCreateContext,
  actor: MainserverMutationActor,
  input: Draft
) => {
  const config = await context.loadValidatedInstanceConfig(actor, 'load_instance_config');
  const { dataProvider } = await context.loadDataProviderIdentityWithConfig(actor, config);
  const created = createResponse.safeParse(
    await context.executeGraphqlWithConfig<unknown>(
      {
        ...actor,
        document: createTourDraftDocument,
        operationName: 'SvaMainserverCreateTourDraft',
        variables: input,
        allowRetry: false,
      },
      config
    )
  );
  if (!created.success)
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Der Mainserver hat keinen gültigen Tourenentwurf zurückgegeben.',
      statusCode: 502,
    });
  return { created: created.data.createTour, providerId: dataProvider.id };
};

const verifyDraft = async (
  reads: ReturnType<typeof createTourReads>,
  actor: MainserverMutationActor,
  result: Awaited<ReturnType<typeof persistDraft>>
) => {
  const { created, providerId } = result;
  const detail = await reads.detail(actor, created.id).catch(() => null);
  const verified =
    created.visible === false &&
    detail?.visible === false &&
    detail.dataProvider?.id === providerId;
  const binding = verified
    ? await recordCreatedMainserverDataProvider({
        actor,
        created: {
          id: created.id,
          dataProvider: { id: providerId, name: detail.dataProvider?.name ?? undefined },
        },
        reread: async () => ({
          id: created.id,
          dataProvider: { id: providerId, name: detail.dataProvider?.name ?? undefined },
        }),
        contentType,
      })
    : undefined;
  const reconciliationRequired =
    !verified || binding?.outcome === 'conflict' || binding?.outcome === 'reconciliation_required';
  await finalizeMainserverMutation({
    actor,
    providerOutcome: 'succeeded',
    reconciliationStatus: reconciliationRequired ? 'reconciliation_required' : 'complete',
    completedSteps: verified ? ['provider_write', 'binding_observation'] : ['provider_write'],
    contentId: created.id,
    ...(verified
      ? { observedDataProviderId: providerId }
      : { lastErrorCode: 'tour_draft_unverified' }),
  });
  return verified
    ? json(
        {
          data: detail,
          ...(reconciliationRequired
            ? { meta: { reconciliationStatus: 'reconciliation_required' } }
            : {}),
        },
        201
      )
    : json(
        {
          error: 'tour_draft_unverified',
          partialSuccess: true,
          details: { contentId: created.id },
        },
        502
      );
};

export const handleTourCreate = async (
  request: Request,
  actor: MainserverMutationActor,
  context: TourCreateContext,
  reads: ReturnType<typeof createTourReads>
): Promise<Response> => {
  const parsed = draftInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorJson(
      400,
      'invalid_request',
      'Bitte prüfen Sie die Eingaben für den Tourenentwurf.'
    );
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey || idempotencyKey.length > 128)
    return errorJson(
      400,
      'idempotency_key_required',
      'Ein gültiger Idempotency-Key ist erforderlich.'
    );
  const { instanceId, actorAccountId, mutationPrincipalContext } = actor;
  const payloadHash = createHash('sha256')
    .update(
      JSON.stringify([
        mutationPrincipalContext.actingPrincipalId,
        mutationPrincipalContext.credentialFingerprint,
        parsed.data,
      ])
    )
    .digest('hex');
  const reservation = { instanceId, actorAccountId, endpoint, idempotencyKey };
  const idempotency = await reserveIdempotency({ ...reservation, payloadHash });
  if (idempotency.status === 'replay')
    return json(idempotency.responseBody, idempotency.responseStatus);
  if (idempotency.status === 'conflict')
    return errorJson(409, 'idempotency_key_reuse', idempotency.message);

  let response: Response;
  let createdId: string | undefined;
  try {
    const authorization = await authorizeMainserverCreateForPrincipal({
      actor,
      action: 'tours.create',
      contentType,
    });
    if (isResponse(authorization)) response = authorization;
    else {
      const result = await persistDraft(context, actor, parsed.data);
      createdId = result.created.id;
      response = await verifyDraft(reads, actor, result);
    }
  } catch (error) {
    await finalizeMainserverMutationFailure({
      actor,
      error,
      providerOutcome: 'unknown',
      contentId: createdId,
    });
    response = toMainserverErrorResponse(error, 'Der Tourenentwurf konnte nicht bestätigt werden.');
  }
  await completeIdempotency({
    ...reservation,
    responseStatus: response.status,
    responseBody: await response.clone().json(),
    status: response.ok ? 'COMPLETED' : 'FAILED',
  });
  return response;
};
