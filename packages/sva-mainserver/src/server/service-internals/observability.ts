import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverConnectionInput } from '../../types.js';

import { normalizeUnexpectedError, type ServiceHop } from './shared.js';

export const logger = createSdkLogger({ component: 'sva-mainserver', level: 'debug' });

const tracer = trace.getTracer('sva.mainserver');
const meter = metrics.getMeter('sva.mainserver');
const hopDurationHistogram = meter.createHistogram('sva_mainserver_hop_duration_ms', {
  description: 'Latenz pro Mainserver-Hop in Millisekunden.',
  unit: 'ms',
});
const hopRequestCounter = meter.createCounter('sva_mainserver_hop_total', {
  description: 'Anzahl der Mainserver-Hops nach Typ und Ergebnis.',
});

export const buildLogContext = (
  input: Pick<SvaMainserverConnectionInput, 'instanceId'>,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => {
  const context = getWorkspaceContext();

  return {
    workspace_id: input.instanceId,
    instance_id: input.instanceId,
    request_id: context.requestId,
    trace_id: context.traceId,
    ...extra,
  };
};

export const buildForwardHeaders = (): Record<string, string> => {
  const context = getWorkspaceContext();
  return {
    ...(context.requestId ? { 'X-Request-Id': context.requestId } : {}),
    ...(context.traceId ? { 'X-Trace-Id': context.traceId } : {}),
  };
};

export const withObservedHop = async <TValue>(
  input: {
    readonly hop: ServiceHop;
    readonly operationName: string;
    readonly connection: SvaMainserverConnectionInput;
  },
  work: () => Promise<TValue>
): Promise<TValue> => {
  const startMs = Date.now();

  return tracer.startActiveSpan(`sva_mainserver.${input.hop}`, async (span) => {
    span.setAttributes({
      'sva_mainserver.hop': input.hop,
      'sva_mainserver.operation': input.operationName,
      workspace_id: input.connection.instanceId,
      instance_id: input.connection.instanceId,
    });

    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      hopDurationHistogram.record(Date.now() - startMs, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'success',
      });
      hopRequestCounter.add(1, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'success',
      });
      return result;
    } catch (error) {
      const normalizedError = normalizeUnexpectedError(error);
      span.recordException(normalizedError);
      span.setStatus({ code: SpanStatusCode.ERROR, message: normalizedError.message });
      hopDurationHistogram.record(Date.now() - startMs, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'error',
        error_code: normalizedError.code,
      });
      hopRequestCounter.add(1, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'error',
        error_code: normalizedError.code,
      });
      throw normalizedError;
    } finally {
      span.end();
    }
  });
};
