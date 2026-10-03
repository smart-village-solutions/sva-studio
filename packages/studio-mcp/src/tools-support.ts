import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { UpstreamSchemaError, type StudioApiClient, type StudioApiRequest } from './api-client.js';
import { schemas } from './contracts.js';
import { diagnoseInstance } from './diagnostics.js';
import { normalizeError } from './errors.js';
import { runStudioInstanceProcess, StudioInstanceProcessError } from './process.js';

export type ToolResult = {
  content: [{ type: 'text'; text: string }];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

export const result = (payload: Record<string, unknown>, isError = false): ToolResult => ({
  content: [
    {
      type: 'text',
      text:
        isError || payload.ok === false
          ? 'Studio-Operation fehlgeschlagen. Details stehen im Fehlervertrag.'
          : 'Studio-Operation erfolgreich.',
    },
  ],
  structuredContent: payload,
  ...(isError ? { isError: true } : {}),
});

const without = <T extends Record<string, unknown>>(
  value: T,
  keys: readonly string[]
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

export const call = async (
  client: StudioApiClient,
  request: StudioApiRequest,
  diagnosis?: { instanceId: string; timeoutMs: number }
): Promise<ToolResult> => {
  const requestId = request.requestId ?? randomUUID();
  const correlatedRequest = { ...request, requestId };
  try {
    const data = await client.request(correlatedRequest);
    return result({
      ok: true,
      data,
      meta: {
        requestId,
        ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
      },
    });
  } catch (caught) {
    if (caught instanceof UpstreamSchemaError) throw caught;
    const error = normalizeError(caught);
    const diagnostics = diagnosis
      ? await diagnoseInstance(client, diagnosis.instanceId, diagnosis.timeoutMs, error).catch(
          () => undefined
        )
      : undefined;
    return result({
      ok: false,
      error,
      ...(diagnostics ? { diagnostics } : {}),
      meta: { requestId: error.requestId },
    });
  }
};

export const callProcess = async (
  client: StudioApiClient,
  params: z.infer<typeof schemas.process>,
  processTimeoutMs: number,
  diagnosisTimeoutMs: number
): Promise<ToolResult> => {
  try {
    const data = await runStudioInstanceProcess(client, params, { timeoutMs: processTimeoutMs });
    return result({ ok: true, data, meta: { requestId: data.requestId } });
  } catch (caught) {
    if (caught instanceof UpstreamSchemaError) throw caught;
    const processError = caught instanceof StudioInstanceProcessError ? caught : undefined;
    const error = normalizeError(processError?.cause ?? caught);
    const diagnostics = await diagnoseInstance(
      client,
      params.instanceId,
      diagnosisTimeoutMs,
      error
    ).catch(() => undefined);
    return result({
      ok: false,
      error,
      ...(processError ? { progress: processError.progress } : {}),
      ...(diagnostics ? { diagnostics } : {}),
      meta: { requestId: error.requestId ?? processError?.progress.requestId },
    });
  }
};

export const mutation = (
  path: string,
  params: Record<string, unknown>,
  method: 'POST' | 'PATCH' = 'POST',
  includeInstanceId = false
): StudioApiRequest => {
  const requestId = randomUUID();
  const idempotency =
    typeof params.idempotencyKey === 'string' ? params.idempotencyKey : randomUUID();
  return {
    method,
    path,
    body: without(params, [
      ...(includeInstanceId ? [] : ['instanceId']),
      'idempotencyKey',
      'challengeId',
      'confirmationPhrase',
    ]),
    requestId,
    idempotencyKey: idempotency,
    ...(typeof params.challengeId === 'string'
      ? { confirmationChallengeId: params.challengeId }
      : {}),
    ...(typeof params.confirmationPhrase === 'string'
      ? { confirmationPhrase: params.confirmationPhrase }
      : {}),
  };
};

export const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;
export const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;
export const nonIdempotentWriteAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;
export const criticalAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;
const outputShape = {
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.unknown().optional(),
  diagnostics: z.unknown().optional(),
  meta: z.record(z.string(), z.unknown()),
};
export const createToolRegistrar =
  (server: McpServer) =>
  <S extends z.ZodObject<z.ZodRawShape>>(
    name: string,
    title: string,
    description: string,
    schema: S,
    annotations:
      | typeof readAnnotations
      | typeof writeAnnotations
      | typeof nonIdempotentWriteAnnotations
      | typeof criticalAnnotations,
    handler: (params: z.infer<S>) => Promise<ToolResult>
  ) =>
    server.registerTool(
      name,
      { title, description, inputSchema: schema.shape, outputSchema: outputShape, annotations },
      async (params) => handler(schema.parse(params))
    );

export type ToolRegistrar = ReturnType<typeof createToolRegistrar>;
