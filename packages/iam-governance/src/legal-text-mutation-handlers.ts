import { updateLegalTextSchema } from './legal-text-schemas.js';
import { createLegalTextResponse, requireActorAccountId } from './legal-text-create-handler.js';
import {
  LegalTextDeleteConflictError,
  type DeleteLegalTextInput,
} from './legal-text-repository.js';
import type { CreateLegalTextInput, UpdateLegalTextInput } from './legal-text-repository-shared.js';

const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export type LegalTextMutationActor = {
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
    readonly loadLegalTextById: (
      instanceId: string,
      legalTextVersionId: string
    ) => Promise<unknown | undefined>;
  };
  readonly logError: (message: string, fields: Record<string, unknown>) => void;
};

export const createLegalTextMutationHandlers = (deps: LegalTextMutationHandlerDeps) => ({
  createLegalTextResponse: (request: Request, actor: LegalTextMutationActor): Promise<Response> =>
    createLegalTextResponse(deps, request, actor),

  updateLegalTextResponse: async (
    request: Request,
    actor: LegalTextMutationActor
  ): Promise<Response> => {
    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    const legalTextVersionId = deps.readPathSegment(request, 4);
    if (!legalTextVersionId) {
      return deps.createApiError(400, 'invalid_request', 'Rechtstext-ID fehlt.', actor.requestId);
    }

    const parsed = await deps.parseRequestBody<
      Omit<
        UpdateLegalTextInput,
        'instanceId' | 'actorAccountId' | 'requestId' | 'traceId' | 'legalTextVersionId'
      >
    >(request, updateLegalTextSchema);
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
        return deps.createApiError(
          404,
          'not_found',
          'Rechtstext-Version wurde nicht gefunden.',
          actor.requestId
        );
      }

      const item = await deps.repository.loadLegalTextById(actor.instanceId, updatedId);
      return item
        ? deps.jsonResponse(200, deps.asApiItem(item, actor.requestId))
        : deps.createApiError(
            404,
            'not_found',
            'Rechtstext-Version wurde nicht gefunden.',
            actor.requestId
          );
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
      return deps.createApiError(
        503,
        'database_unavailable',
        'Rechtstext konnte nicht aktualisiert werden.',
        actor.requestId
      );
    }
  },

  deleteLegalTextResponse: async (
    request: Request,
    actor: LegalTextMutationActor
  ): Promise<Response> => {
    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    const legalTextVersionId = deps.readPathSegment(request, 4);
    if (!legalTextVersionId) {
      return deps.createApiError(400, 'invalid_request', 'Rechtstext-ID fehlt.', actor.requestId);
    }
    if (!UUID_LIKE_PATTERN.test(legalTextVersionId)) {
      return deps.createApiError(
        400,
        'invalid_request',
        'Rechtstext-ID ist ungültig.',
        actor.requestId
      );
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
        : deps.createApiError(
            404,
            'not_found',
            'Rechtstext-Version wurde nicht gefunden.',
            actor.requestId
          );
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
      return deps.createApiError(
        503,
        'database_unavailable',
        'Rechtstext konnte nicht gelöscht werden.',
        actor.requestId
      );
    }
  },
});
