import type { AcceptanceProbeResult } from '../runtime-env.shared.ts';
import { createAcceptanceProbeResult } from './acceptance-probe.ts';
import type { RunHttpProbeInput } from './acceptance-runtime-checks.types.ts';

export const runHttpProbe = async (
  input: RunHttpProbeInput,
  options?: {
    fetchImpl?: typeof fetch;
  },
): Promise<AcceptanceProbeResult> => {
  const startedAt = Date.now();
  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(input.target, {
      headers: input.headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    const rawText = await response.text();
    let payload: unknown;

    try {
      payload = rawText.length > 0 ? JSON.parse(rawText) : null;
    } catch {
      payload = rawText;
    }

    const expectationError = input.expect(response, payload);
    return createAcceptanceProbeResult({
      ...(expectationError ? { details: { payload } } : {}),
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      message: expectationError ?? `Probe erfolgreich mit HTTP ${response.status}.`,
      name: input.name,
      scope: input.scope,
      status: expectationError ? 'error' : 'ok',
      target: input.target,
    });
  } catch (error) {
    return createAcceptanceProbeResult({
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
      name: input.name,
      scope: input.scope,
      status: 'error',
      target: input.target,
    });
  }
};
