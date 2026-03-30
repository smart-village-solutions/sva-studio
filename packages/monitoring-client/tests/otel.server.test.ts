import { ROOT_CONTEXT, diag } from '@opentelemetry/api';
import type { AttributeValue } from '@opentelemetry/api';
import type { Context } from '@opentelemetry/api';
import type { LogRecordProcessor, SdkLogRecord } from '@opentelemetry/sdk-logs';
import type { NodeSDK } from '@opentelemetry/sdk-node';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RedactingLogProcessor,
  createOtelSdk,
  maskEmailAddresses,
  redactString,
  redactValue,
  setWorkspaceContextGetter,
  startOtelSdk,
  toAttributeValue,
} from '../src/otel.server.js';
import { logs } from '@opentelemetry/api-logs';

class InMemoryLogProcessor implements LogRecordProcessor {
  public readonly emitted: SdkLogRecord[] = [];

  public onEmit(logRecord: SdkLogRecord, _context: Context): void {
    this.emitted.push(logRecord);
  }

  public forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

const createMutableRecord = (
  body: unknown,
  attributes: Record<string, AttributeValue>
): SdkLogRecord => {
  const record = {
    body,
    attributes,
    setAttribute: vi.fn((key: string, value: AttributeValue) => {
      attributes[key] = value;
    }),
  } as unknown as SdkLogRecord;

  return record;
};

describe('otel.server helpers', () => {
  afterEach(() => {
    setWorkspaceContextGetter(() => ({}));
    vi.restoreAllMocks();
  });

  it('maskEmailAddresses masks valid addresses and keeps invalid fragments', () => {
    expect(maskEmailAddresses('Mail: alice@example.org')).toBe('Mail: a***@example.org');
    expect(maskEmailAddresses('invalid@ localhost')).toBe('invalid@ localhost');
    expect(maskEmailAddresses('x@y.z')).toBe('x@y.z');
  });

  it('redactString redacts jwt, bearer, token parameters and secrets', () => {
    const input =
      'authorization: Bearer abc.def.ghi token=xyz id_token_hint=hint api_key=key password=secret alice@example.org';

    const redacted = redactString(input);

    expect(redacted).toContain('authorization: [REDACTED]');
    expect(redacted).toContain('token=[REDACTED]');
    expect(redacted).toContain('id_token_hint=[REDACTED]');
    expect(redacted).toContain('api_key=[REDACTED]');
    expect(redacted).toContain('password=[REDACTED]');
    expect(redacted).toContain('a***@example.org');
  });

  it('redactValue redacts forbidden keys recursively', () => {
    const input = {
      email: 'alice@example.org',
      nested: {
        token: 'foo',
        safe: 'ok',
      },
      list: [{ session_id: '123' }, 'keep'],
    };

    const result = redactValue(input) as {
      email: string;
      nested: { token: string; safe: string };
      list: Array<{ session_id: string } | string>;
    };

    expect(result.email).toBe('[REDACTED]');
    expect(result.nested.token).toBe('[REDACTED]');
    expect(result.nested.safe).toBe('ok');
    expect(result.list[0]).toEqual({ session_id: '[REDACTED]' });
    expect(result.list[1]).toBe('keep');

    expect(redactValue(42)).toBe(42);
  });

  it('toAttributeValue converts nulls, arrays and objects as expected', () => {
    expect(toAttributeValue(null)).toBe('null');
    expect(toAttributeValue(undefined)).toBe('null');
    expect(toAttributeValue(['a', 1, true])).toEqual(['a', '1', 'true']);
    expect(toAttributeValue({ k: 'v' })).toBe('{"k":"v"}');
    expect(toAttributeValue(false)).toBe(false);
    expect(toAttributeValue(Symbol('x'))).toBe('Symbol(x)');
  });

  it('RedactingLogProcessor enriches workspace, strips disallowed labels and redacts context in body', () => {
    setWorkspaceContextGetter(() => ({ workspaceId: 'ws-1' }));

    const inner = new InMemoryLogProcessor();
    const processor = new RedactingLogProcessor(inner);

    const attributes: Record<string, AttributeValue> = {
      component: 'auth',
      environment: 'test',
      level: 'info',
      user_id: 'u-1',
      context: { token: 'abc' } as unknown as AttributeValue,
    };

    const record = createMutableRecord('failed for alice@example.org', attributes);

    processor.onEmit(record, ROOT_CONTEXT);

    expect(record.setAttribute).toHaveBeenCalledWith('workspace_id', 'ws-1');
    expect(record.body).toContain('a***@example.org');
    expect(record.body).toContain('[REDACTED]');
    expect((record.attributes as Record<string, AttributeValue>).user_id).toBeUndefined();
    expect(inner.emitted).toHaveLength(1);
  });

  it('RedactingLogProcessor forwards forceFlush and shutdown', async () => {
    const inner = new InMemoryLogProcessor();
    const processor = new RedactingLogProcessor(inner);

    await expect(processor.forceFlush()).resolves.toBeUndefined();
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });

  it('RedactingLogProcessor works without optional attributes and setAttribute callback', () => {
    setWorkspaceContextGetter(() => ({}));

    const inner = new InMemoryLogProcessor();
    const processor = new RedactingLogProcessor(inner);

    const record = {
      body: { message: 'not-string' },
      attributes: undefined,
      setAttribute: undefined,
    } as unknown as SdkLogRecord;

    processor.onEmit(record, ROOT_CONTEXT);

    expect(inner.emitted).toHaveLength(1);
  });

  it('createOtelSdk supports explicit endpoint and logLevel in development mode', () => {
    const setLoggerSpy = vi.spyOn(diag, 'setLogger');

    const sdk = createOtelSdk({
      serviceName: 'svc-test',
      environment: 'development',
      otlpEndpoint: 'http://collector:4318',
      logLevel: 1,
    });

    expect(sdk).toBeDefined();
    expect(setLoggerSpy).toHaveBeenCalled();
  });

  it('createOtelSdk falls back to env endpoint and default environment without log level', () => {
    const previousOtlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://env-collector:4318';
    process.env.NODE_ENV = 'production';

    const setLoggerSpy = vi.spyOn(diag, 'setLogger');

    const sdk = createOtelSdk({
      serviceName: 'svc-test',
      environment: 'production',
    });

    expect(sdk).toBeDefined();
    expect(setLoggerSpy).not.toHaveBeenCalled();

    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = previousOtlpEndpoint;
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('createOtelSdk uses localhost endpoint and development env as last fallback', () => {
    const previousOtlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const previousNodeEnv = process.env.NODE_ENV;

    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.NODE_ENV;

    const sdk = createOtelSdk({
      serviceName: 'svc-test-fallback',
    });

    expect(sdk).toBeDefined();

    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = previousOtlpEndpoint;
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('startOtelSdk starts sdk and handles available global logger provider', async () => {
    const getLoggerProviderSpy = vi.spyOn(logs, 'getLoggerProvider');
    const sdk = await startOtelSdk({
      serviceName: 'svc-test',
      environment: 'production',
      otlpEndpoint: 'http://localhost:4318',
    });

    expect(sdk).toBeDefined();
    expect(getLoggerProviderSpy).toHaveBeenCalled();
    await (sdk as NodeSDK).shutdown();
  });

  it('startOtelSdk keeps working when no global logger provider exists', async () => {
    vi.spyOn(logs, 'getLoggerProvider').mockReturnValue(undefined as never);

    const sdk = await startOtelSdk({
      serviceName: 'svc-test',
      environment: 'production',
      otlpEndpoint: 'http://localhost:4318',
    });

    expect(sdk).toBeDefined();
    await (sdk as NodeSDK).shutdown();
  });
});
