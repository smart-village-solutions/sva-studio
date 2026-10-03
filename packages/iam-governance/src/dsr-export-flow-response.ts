import {
  collectDsrExportPayload,
  serializeDsrExportPayload,
  type DsrExportFormat,
} from './dsr-export-payload.js';
import type { DsrExportFlowDeps } from './dsr-export-flow-types.js';

type IdempotentTextResponse = {
  kind: 'text';
  body: string;
  contentType: string;
};

export const SELF_EXPORT_ENDPOINT = 'POST:/iam/me/data-export';
export const ADMIN_EXPORT_ENDPOINT = 'POST:/iam/admin/data-subject-rights/export';

const asIdempotentTextResponse = (body: string, contentType: string): IdempotentTextResponse => ({
  kind: 'text',
  body,
  contentType,
});

export const toResponseFromIdempotencyPayload = (
  deps: Pick<DsrExportFlowDeps, 'jsonResponse' | 'textResponse'>,
  status: number,
  payload: unknown
): Response => {
  if (
    payload &&
    typeof payload === 'object' &&
    'kind' in payload &&
    (payload as { kind?: unknown }).kind === 'text'
  ) {
    const typedPayload = payload as { body?: unknown; contentType?: unknown };
    return deps.textResponse(
      status,
      typeof typedPayload.body === 'string' ? typedPayload.body : '',
      typeof typedPayload.contentType === 'string'
        ? typedPayload.contentType
        : 'text/plain; charset=utf-8'
    );
  }

  return deps.jsonResponse(status, payload);
};

const completeTextExportIdempotency = (
  deps: DsrExportFlowDeps,
  input: {
    instanceId: string;
    actorAccountId: string;
    endpoint: string;
    idempotencyKey: string;
    responseStatus: number;
    body: string;
    contentType: string;
  }
): Promise<void> =>
  deps.completeIdempotency({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    endpoint: input.endpoint,
    idempotencyKey: input.idempotencyKey,
    status: 'COMPLETED',
    responseStatus: input.responseStatus,
    responseBody: asIdempotentTextResponse(input.body, input.contentType),
  });

export const createSyncExportResponse = async (
  deps: DsrExportFlowDeps,
  input: {
    instanceId: string;
    actorAccountId: string;
    endpoint: string;
    idempotencyKey: string;
    format: DsrExportFormat;
    payload: Awaited<ReturnType<typeof collectDsrExportPayload>>;
  }
): Promise<Response> => {
  if (input.format === 'json') {
    const body = JSON.stringify(input.payload, null, 2);
    await completeTextExportIdempotency(deps, {
      ...input,
      responseStatus: 200,
      body,
      contentType: 'application/json',
    });
    return deps.textResponse(200, body, 'application/json');
  }

  const body = serializeDsrExportPayload(input.format, input.payload);
  const contentType =
    input.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/xml; charset=utf-8';
  await completeTextExportIdempotency(deps, {
    ...input,
    responseStatus: 200,
    body,
    contentType,
  });
  return deps.textResponse(200, body, contentType);
};
