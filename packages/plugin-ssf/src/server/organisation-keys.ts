import type {
  PluginServerExecutionHandler,
  PluginServerHandlerExecutionContext,
  SsfRecordingGatewayRequest,
} from '@sva/plugin-sdk';
import { SSF_DIRECTORY_PERMISSION_IDS } from '../constants.js';
import { errors, operationSchemas, subject, uuid } from '../organisation-key-contracts.js';
import { type SsfPluginServerCapabilities } from '../recording-directory.js';

const headers = { 'Cache-Control': 'no-store' };
const failure = (status: number, code: string) =>
  Response.json({ error: { code } }, { status, headers });
const readBoundedJson = async (body: Request | Response, limit: number): Promise<unknown> => {
  if (Number(body.headers.get('content-length')) > limit || !body.body) throw new Error();
  const reader = body.body.getReader(),
    decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0,
    text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
};
const directoryHandler =
  (capabilities?: SsfPluginServerCapabilities): PluginServerExecutionHandler =>
  async (ctx) => {
    if (ctx.scope !== 'tenant' || !ctx.actor.instanceId || !capabilities)
      return failure(503, 'RECORDING_UNAVAILABLE');
    try {
      const people = await capabilities.readPermissionDirectorySubjects({
        instanceId: ctx.actor.instanceId,
        permissionIds: SSF_DIRECTORY_PERMISSION_IDS,
      });
      return Response.json(
        {
          users: people.map((p) => ({
            sub: subject.parse(p.keycloakSubject),
            displayName: p.displayName.slice(0, 200),
          })),
        },
        { headers }
      );
    } catch {
      return failure(503, 'RECORDING_UNAVAILABLE');
    }
  };

type Operation = (typeof operationSchemas)[keyof typeof operationSchemas];
type UserContext = Extract<PluginServerHandlerExecutionContext, { sessionId: string }>;

const candidateQuery = (query: URLSearchParams) => {
  for (const key of query.keys()) {
    if (!['employeeSub', 'cursor'].includes(key) || query.getAll(key).length !== 1)
      throw new Error();
  }
  subject.parse(query.get('employeeSub'));
  const cursor = query.get('cursor');
  if (cursor !== null && (!cursor || cursor.length > 2048)) throw new Error();
  return '?' + query.toString();
};

const recordingRequest = async (
  ctx: UserContext,
  operation: Operation
): Promise<SsfRecordingGatewayRequest> => {
  let path: string = operation.path;
  if (path.includes('$id')) path = path.replace('$id', uuid.parse(ctx.pathParams.id));
  if (path.includes('$sub'))
    path = path.replace('$sub', encodeURIComponent(subject.parse(ctx.pathParams.sub)));
  const query = new URL(ctx.request.url).searchParams;
  if (operation === operationSchemas.candidates) path += candidateQuery(query);
  else if (query.size) throw new Error();

  if ('input' in operation) {
    const body = JSON.stringify(
      operation.input.parse(await readBoundedJson(ctx.request, 512 * 1024))
    );
    return { method: operation.method, path, body };
  }
  if (ctx.request.body) throw new Error();
  return { method: operation.method, path };
};

const recordingResponse = async (operation: Operation, upstream: Response) => {
  if (upstream.status === 401) return failure(401, 'AUTHENTICATION_REQUIRED');
  if (!upstream.ok) {
    const raw = (await readBoundedJson(upstream, 8192)) as {
      error?: { code?: unknown };
      detail?: { code?: unknown; error_code?: unknown };
      code?: unknown;
    };
    const parsed = errors.safeParse(
      raw?.error?.code ?? raw?.detail?.error_code ?? raw?.detail?.code ?? raw?.code
    );
    return parsed.success
      ? failure(upstream.status, parsed.data)
      : failure(503, 'RECORDING_UNAVAILABLE');
  }
  if (operation === operationSchemas.abandon) return new Response(null, { status: 204, headers });
  const parsed = operation.output.safeParse(await readBoundedJson(upstream, 4 * 1024 * 1024));
  if (!parsed.success) return failure(503, 'RECORDING_UNAVAILABLE');
  return Response.json(parsed.data, { headers });
};

const operationHandler =
  (operation: Operation): PluginServerExecutionHandler =>
  async (ctx) => {
    if (ctx.scope !== 'tenant' || !ctx.actor.instanceId || !ctx.forwardSsfRecordingRequest)
      return failure(503, 'RECORDING_UNAVAILABLE');
    let request: SsfRecordingGatewayRequest;
    try {
      request = await recordingRequest(ctx, operation);
    } catch {
      return failure(422, 'INVALID_KEY');
    }
    try {
      return await recordingResponse(operation, await ctx.forwardSsfRecordingRequest(request));
    } catch {
      return failure(503, 'RECORDING_UNAVAILABLE');
    }
  };

export const createRecordingKeyHandlers = (
  capabilities?: SsfPluginServerCapabilities
): Record<string, PluginServerExecutionHandler> => {
  const handlers: Record<string, PluginServerExecutionHandler> = {
    'ssf.access-transfer.people': directoryHandler(capabilities),
  };
  for (const operation of Object.values(operationSchemas))
    handlers[operation.id] = operationHandler(operation);
  return handlers;
};
