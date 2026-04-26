import { createLegalTextSchema, updateLegalTextSchema } from './legal-text-schemas.js';
import { LegalTextDeleteConflictError, type DeleteLegalTextInput } from './legal-text-repository.js';
import type { CreateLegalTextInput, UpdateLegalTextInput } from './legal-text-repository-shared.js';

const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CREATE_LEGAL_TEXT_ENDPOINT = 'POST:/api/v1/iam/legal-texts';

type CreateApiError = (
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
) => Response;

type ParseRequestBody = <T>(
  request: Request,
  schema: unknown
) => Promise<{ ok: true; data: T; rawBody: string } | { ok: false; message: string }>;

type RequireIdempotencyKey = (
  request: Request,
  requestId?: string
) => { key: string } | { error: Response };

type ReserveIdempotency = (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  payloadHash: string;
}) => Promise<
  | { status: 'reserved' }
  | { status: 'replay'; responseStatus: number; responseBody: unknown }
  | { status: 'conflict'; message: string }
>;

type CompleteIdempotency = (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  status: 'FAILED' | 'COMPLETED';
  responseStatus: number;
  responseBody: Record<string, unknown>;
}) => Promise<void>;

type LegalTextMutationActor = {
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
};

export type LegalTextMutationHandlerDeps = {
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly requireIdempotencyKey: RequireIdempotencyKey;
  readonly parseRequestBody: ParseRequestBody;
  readonly toPayloadHash: (rawBody: string) => string;
  readonly reserveIdempotency: ReserveIdempotency;
  readonly completeIdempotency: CompleteIdempotency;
  readonly readPathSegment: (request: Request, index: number) => string | undefined;
  readonly createApiError: CreateApiError;
  readonly asApiItem: <T>(value: T, requestId?: string) => Record<string, unknown>;
  readonly jsonResponse: (status: number, body: unknown) => Response;
  readonly repository: {
    readonly createLegalTextVersion: (input: CreateLegalTextInput) => Promise<string | undefined>;
    readonly updateLegalTextVersion: (input: UpdateLegalTextInput) => Promise<string | undefined>;
    readonly deleteLegalTextVersion: (input: DeleteLegalTextInput) => Promise<string | undefined>;
    readonly loadLegalTextById: (instanceId: string, legalTextVersionId: string) => Promise<unknown | undefined>;
  };
  readonly logError: (message: string, fields: Record<string, unknown>) => void;
};

const withRequestId = (requestId: string | undefined, body: Record<string, unknown>) => ({
  ...body,
  ...(requestId ? { requestId } : {}),
});

const requireActorAccountId = (
  deps: LegalTextMutationHandlerDeps,
  actor: LegalTextMutationActor
): string | Response =>
  actor.actorAccountId ??
  deps.createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actor.requestId);

const completeCreateIdempotency = async (
  deps: LegalTextMutationHandlerDeps,
  actor: LegalTextMutationActor,
  actorAccountId: string,
  idempotencyKey: string,
  responseStatus: number,
  responseBody: Record<string, unknown>
) =>
  deps.completeIdempotency({
    instanceId: actor.instanceId,
    actorAccountId,
    endpoint: CREATE_LEGAL_TEXT_ENDPOINT,
    idempotencyKey,
    status: responseStatus >= 400 ? 'FAILED' : 'COMPLETED',
    responseStatus,
    responseBody,
  });

const createFailureResponse = async (
  deps: LegalTextMutationHandlerDeps,
  actor: LegalTextMutationActor,
  actorAccountId: string,
  idempotencyKey: string,
  status: number,
  code: string,
  message: string
) => {
  const responseBody = withRequestId(actor.requestId, { error: { code, message } });
  await completeCreateIdempotency(deps, actor, actorAccountId, idempotencyKey, status, responseBody);
  return deps.jsonResponse(status, responseBody);
};

export const createLegalTextMutationHandlers = (deps: LegalTextMutationHandlerDeps) => ({
  createLegalTextResponse: async (request: Request, actor: LegalTextMutationActor): Promise<Response> => {
    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    const idempotencyKey = deps.requireIdempotencyKey(request, actor.requestId);
    if ('error' in idempotencyKey) {
      return idempotencyKey.error;
    }
    const actorAccountId = requireActorAccountId(deps, actor);
    if (actorAccountId instanceof Response) {
      return actorAccountId;
    }

    const parsed = await deps.parseRequestBody<Omit<CreateLegalTextInput, 'instanceId' | 'actorAccountId' | 'requestId' | 'traceId'>>(
      request,
      createLegalTextSchema
    );
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', parsed.message, actor.requestId);
    }

    const reserve = await deps.reserveIdempotency({
      instanceId: actor.instanceId,
      actorAccountId,
      endpoint: CREATE_LEGAL_TEXT_ENDPOINT,
      idempotencyKey: idempotencyKey.key,
      payloadHash: deps.toPayloadHash(parsed.rawBody),
    });
    if (reserve.status === 'replay') {
      return deps.jsonResponse(reserve.responseStatus, reserve.responseBody);
    }
    if (reserve.status === 'conflict') {
      return deps.createApiError(409, 'idempotency_key_reuse', reserve.message, actor.requestId);
    }

    try {
      const createdId = await deps.repository.createLegalTextVersion({
        instanceId: actor.instanceId,
        actorAccountId,
        requestId: actor.requestId,
        traceId: actor.traceId,
        ...parsed.data,
      });
      if (!createdId) {
        return createFailureResponse(
          deps,
          actor,
          actorAccountId,
          idempotencyKey.key,
          409,
          'conflict',
          'Diese Rechtstext-Version existiert bereits.'
        );
      }

      const item = await deps.repository.loadLegalTextById(actor.instanceId, createdId);
      if (!item) {
        throw new Error('created_legal_text_not_found');
      }

      const responseBody = deps.asApiItem(item, actor.requestId);
      await completeCreateIdempotency(deps, actor, actorAccountId, idempotencyKey.key, 201, responseBody);
      return deps.jsonResponse(201, responseBody);
    } catch (error) {
      if (error instanceof Error && error.message === 'legal_text_published_at_required') {
        return createFailureResponse(
          deps,
          actor,
          actorAccountId,
          idempotencyKey.key,
          400,
          'invalid_request',
          'Veröffentlichungsdatum ist für gültige Rechtstexte erforderlich.'
        );
      }
      deps.logError('Legal text create failed', {
        operation: 'legal_text_create',
        instance_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return createFailureResponse(
        deps,
        actor,
        actorAccountId,
        idempotencyKey.key,
        503,
        'database_unavailable',
        'Rechtstext konnte nicht gespeichert werden.'
      );
    }
  },

  updateLegalTextResponse: async (request: Request, actor: LegalTextMutationActor): Promise<Response> => {
    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    const legalTextVersionId = deps.readPathSegment(request, 4);
    if (!legalTextVersionId) {
      return deps.createApiError(400, 'invalid_request', 'Rechtstext-ID fehlt.', actor.requestId);
    }

    const parsed = await deps.parseRequestBody<Omit<UpdateLegalTextInput, 'instanceId' | 'actorAccountId' | 'requestId' | 'traceId' | 'legalTextVersionId'>>(
      request,
      updateLegalTextSchema
    );
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', parsed.message, actor.requestId);
    }
    const actorAccountId = requireActorAccountId(deps, actor);
    if (actorAccountId instanceof Response) {
      return actorAccountId;
    }

    try {
      const updatedId = await deps.repository.updateLegalTextVersion({
        instanceId: actor.instanceId,
        actorAccountId,
        requestId: actor.requestId,
        traceId: actor.traceId,
        legalTextVersionId,
        ...parsed.data,
      });
      if (!updatedId) {
        return deps.createApiError(404, 'not_found', 'Rechtstext-Version wurde nicht gefunden.', actor.requestId);
      }

      const item = await deps.repository.loadLegalTextById(actor.instanceId, updatedId);
      return item
        ? deps.jsonResponse(200, deps.asApiItem(item, actor.requestId))
        : deps.createApiError(404, 'not_found', 'Rechtstext-Version wurde nicht gefunden.', actor.requestId);
    } catch (error) {
      if (error instanceof Error && error.message === 'legal_text_published_at_required') {
        return deps.createApiError(
          400,
          'invalid_request',
          'Veröffentlichungsdatum ist für gültige Rechtstexte erforderlich.',
          actor.requestId
        );
      }
      deps.logError('Legal text update failed', {
        operation: 'legal_text_update',
        instance_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        legal_text_version_id: legalTextVersionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return deps.createApiError(503, 'database_unavailable', 'Rechtstext konnte nicht aktualisiert werden.', actor.requestId);
    }
  },

  deleteLegalTextResponse: async (request: Request, actor: LegalTextMutationActor): Promise<Response> => {
    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    const legalTextVersionId = deps.readPathSegment(request, 4);
    if (!legalTextVersionId) {
      return deps.createApiError(400, 'invalid_request', 'Rechtstext-ID fehlt.', actor.requestId);
    }
    if (!UUID_LIKE_PATTERN.test(legalTextVersionId)) {
      return deps.createApiError(400, 'invalid_request', 'Rechtstext-ID ist ungültig.', actor.requestId);
    }
    const actorAccountId = requireActorAccountId(deps, actor);
    if (actorAccountId instanceof Response) {
      return actorAccountId;
    }

    try {
      const deletedId = await deps.repository.deleteLegalTextVersion({
        instanceId: actor.instanceId,
        actorAccountId,
        requestId: actor.requestId,
        traceId: actor.traceId,
        legalTextVersionId,
      });

      return deletedId
        ? deps.jsonResponse(200, deps.asApiItem({ id: deletedId }, actor.requestId))
        : deps.createApiError(404, 'not_found', 'Rechtstext-Version wurde nicht gefunden.', actor.requestId);
    } catch (error) {
      if (error instanceof LegalTextDeleteConflictError) {
        return deps.createApiError(
          409,
          'conflict',
          'Rechtstext-Version kann nicht gelöscht werden, weil bereits Zustimmungen vorliegen.',
          actor.requestId
        );
      }
      deps.logError('Legal text delete failed', {
        operation: 'legal_text_delete',
        instance_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        legal_text_version_id: legalTextVersionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return deps.createApiError(503, 'database_unavailable', 'Rechtstext konnte nicht gelöscht werden.', actor.requestId);
    }
  },
});
