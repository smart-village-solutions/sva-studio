import { createHash } from 'node:crypto';
import { completeIdempotency, reserveIdempotency } from '@sva/auth-runtime/server';
import type { z } from 'zod';

import type { SvaMainserverConnectionInput, SvaMainserverErrorCode } from '../types.js';
import { errorJson, isResponse, json, withMutationNotApplied } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  finalizeMainserverMutationFailure,
  resolveMainserverResourceAccess,
  type MainserverMutationActor,
} from './mutation-principal.js';
import type { DataProviderBearingItem } from './mutation-principal-types.js';
import type { ServiceContext } from './service-internals/service-context.js';

import {
  editableTourDocument,
  editTourDocument,
  readResult,
  updateInput,
  updateResult,
} from './tour-editor-contract.js';

const contentType = 'tours.tour';
const action = 'tours.update';

const invalidResponse = () =>
  new SvaMainserverError({
    code: 'invalid_response',
    message: 'Ungültige Mainserver-Tourendaten.',
    statusCode: 502,
  });

const notFound = () => errorJson(404, 'not_found', 'Tour wurde nicht gefunden.');
const forbidden = () =>
  errorJson(403, 'forbidden', 'Die Tour kann im aktiven Kontext nicht bearbeitet werden.');
const revisionConflict = () =>
  errorJson(409, 'tour_revision_conflict', 'Die Tour wurde zwischenzeitlich geändert.');
const preWriteErrors = new Set([
  'invalid_request',
  'tour_revision_conflict',
  'not_found',
  'forbidden',
]);
const providerErrors = new Map<string, [SvaMainserverErrorCode, number, string]>([
  [
    'TOUR_REVISION_CONFLICT',
    ['tour_revision_conflict', 409, 'Die Tour wurde zwischenzeitlich geändert.'],
  ],
  ['TOUR_INVALID_PATCH', ['invalid_request', 400, 'Bitte prüfen Sie die Änderungen an der Tour.']],
  ['TOUR_NOT_FOUND', ['not_found', 404, 'Tour wurde nicht gefunden.']],
]);

const mapEditorError = (providerCode: string): SvaMainserverError | undefined => {
  const failure = providerErrors.get(providerCode);
  if (!failure) return undefined;
  const [code, statusCode, message] = failure;
  return new SvaMainserverError({ code, statusCode, message });
};

type EditorContext = Pick<
  ServiceContext,
  'loadValidatedInstanceConfig' | 'loadDataProviderIdentityWithConfig' | 'executeGraphqlWithConfig'
>;

export const hasExactTourEditorAccess = async (
  actor: MainserverMutationActor,
  tour: DataProviderBearingItem
): Promise<boolean> => {
  const actions = ['tours.read', action];
  const access = await resolveMainserverResourceAccess({
    actor,
    contentId: tour.id,
    item: tour,
    contentType,
    actions,
    forceExactScopeActions: actions,
  });
  return Boolean(access['tours.read'] && access[action]);
};

export const createTourEditor = (context: EditorContext) => {
  const load = async (actor: SvaMainserverConnectionInput, id: string) => {
    const config = await context.loadValidatedInstanceConfig(actor, 'load_instance_config');
    const { dataProvider } = await context.loadDataProviderIdentityWithConfig(actor, config);
    const result = readResult.safeParse(
      await context.executeGraphqlWithConfig<unknown>(
        {
          ...actor,
          document: editableTourDocument,
          operationName: 'SvaMainserverEditableTour',
          variables: { id },
          mapErrorCode: mapEditorError,
        },
        config
      )
    );
    if (!result.success) throw invalidResponse();
    const tour = result.data.editableTour;
    return {
      config,
      tour: tour?.id === id && tour.dataProvider.id === dataProvider.id ? tour : null,
    };
  };

  return {
    async read(actor: SvaMainserverConnectionInput, id: string) {
      return (await load(actor, id)).tour;
    },
    async persist(actor: MainserverMutationActor, id: string, input: z.output<typeof updateInput>) {
      const { config, tour } = await load(actor, id);
      if (!tour) return withMutationNotApplied(notFound());
      if (!(await hasExactTourEditorAccess(actor, tour)))
        return withMutationNotApplied(forbidden());
      const authorization = await authorizeMainserverExistingContent({
        actor,
        action,
        contentType,
        contentId: id,
        item: tour,
        forceExactScopeAuthorization: true,
      });
      if (isResponse(authorization)) return withMutationNotApplied(authorization);
      if (tour.revision !== input.expectedRevision) {
        await finalizeMainserverMutation({
          actor,
          providerOutcome: 'failed',
          reconciliationStatus: 'complete',
          completedSteps: [],
          contentId: id,
          lastErrorCode: 'tour_revision_conflict',
        });
        return withMutationNotApplied(revisionConflict());
      }

      const result = updateResult.safeParse(
        await context.executeGraphqlWithConfig<unknown>(
          {
            ...actor,
            document: editTourDocument,
            operationName: 'SvaMainserverEditTour',
            variables: { id, expectedRevision: input.expectedRevision, ...input.patch },
            mapErrorCode: mapEditorError,
            allowRetry: false,
          },
          config
        )
      );
      if (!result.success) throw invalidResponse();
      const saved = result.data.createTour.editorialSnapshot;
      const observed = await load(actor, id)
        .then(({ tour }) => tour)
        .catch(() => null);
      const confirmed =
        saved.id === id &&
        saved.dataProvider.id === tour.dataProvider.id &&
        observed?.dataProvider.id === tour.dataProvider.id &&
        observed.revision === saved.revision;
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: confirmed ? 'complete' : 'reconciliation_required',
        completedSteps: ['provider_write'],
        contentId: id,
        observedDataProviderId: tour.dataProvider.id,
        ...(!confirmed ? { lastErrorCode: 'tour_update_unverified' } : {}),
      });
      return confirmed
        ? json({ data: observed })
        : json(
            {
              error: 'tour_update_unverified',
              partialSuccess: true,
              details: { contentId: id },
            },
            502
          );
    },
  };
};

const restoreRetryMetadata = (response: Response, body: unknown): Response =>
  typeof body === 'object' &&
  body !== null &&
  'error' in body &&
  typeof body.error === 'string' &&
  preWriteErrors.has(body.error)
    ? withMutationNotApplied(response)
    : response;

export const handleTourUpdate = async (
  request: Request,
  actor: MainserverMutationActor,
  id: string,
  editor: ReturnType<typeof createTourEditor>
): Promise<Response> => {
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return withMutationNotApplied(
      errorJson(400, 'invalid_request', 'Bitte prüfen Sie die Änderungen an der Tour.')
    );
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey || idempotencyKey.length > 128)
    return withMutationNotApplied(
      errorJson(400, 'idempotency_key_required', 'Ein gültiger Idempotency-Key ist erforderlich.')
    );

  const { instanceId, actorAccountId, mutationPrincipalContext } = actor;
  const payloadHash = createHash('sha256')
    .update(
      JSON.stringify([
        mutationPrincipalContext.actingPrincipalId,
        mutationPrincipalContext.credentialFingerprint,
        id,
        parsed.data,
      ])
    )
    .digest('hex');
  const reservation = {
    instanceId,
    actorAccountId,
    endpoint: 'PATCH:/api/v1/mainserver/tours',
    idempotencyKey,
  };
  const idempotency = await reserveIdempotency({ ...reservation, payloadHash });
  if (idempotency.status === 'replay') {
    if (idempotency.responseStatus >= 200 && idempotency.responseStatus < 300) {
      const tour = await editor.read(actor, id);
      if (!tour) return withMutationNotApplied(notFound());
      if (!(await hasExactTourEditorAccess(actor, tour)))
        return withMutationNotApplied(forbidden());
    }
    return restoreRetryMetadata(
      json(idempotency.responseBody, idempotency.responseStatus),
      idempotency.responseBody
    );
  }
  if (idempotency.status === 'conflict')
    return errorJson(409, 'idempotency_key_reuse', idempotency.message);

  let response: Response;
  try {
    response = await editor.persist(actor, id, parsed.data);
  } catch (error) {
    const known = error instanceof SvaMainserverError && preWriteErrors.has(error.code);
    await finalizeMainserverMutationFailure({
      actor,
      error,
      providerOutcome: known ? 'failed' : 'unknown',
      contentId: id,
    });
    response =
      error instanceof SvaMainserverError
        ? errorJson(
            error.statusCode,
            error.code,
            known ? error.message : 'Die Änderung konnte nicht bestätigt werden.'
          )
        : errorJson(500, 'internal_error', 'Die Änderung konnte nicht bestätigt werden.');
    if (known) withMutationNotApplied(response);
  }
  await completeIdempotency({
    ...reservation,
    responseStatus: response.status,
    responseBody: await response.clone().json(),
    status: response.ok ? 'COMPLETED' : 'FAILED',
  });
  return response;
};
