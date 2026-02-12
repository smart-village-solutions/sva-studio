import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  type AttributeValue,
  type Attributes,
  type Context
} from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor, LogRecordProcessor, type SdkLogRecord } from '@opentelemetry/sdk-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { logs } from '@opentelemetry/api-logs';

import { getWorkspaceContext } from '@sva/sdk/server';
import { setGlobalLoggerProvider } from './logger-provider.server';

const allowedLabelKeys = new Set(['workspace_id', 'component', 'environment', 'level']);

const forbiddenLabelKeys = new Set([
  'user_id',
  'session_id',
  'email',
  'request_id',
  'token',
  'authorization',
  'api_key',
  'secret',
  'ip'
]);

const emailRegex = /([\w.%+-])([\w.%+-]*)(@[\w.-]+\.[A-Za-z]{2,})/g;

const maskEmail = (value: string): string => {
  return value.replace(emailRegex, (_, firstChar, _middle, domain) => `${firstChar}***${domain}`);
};

const redactValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return maskEmail(value);
  }
  return value;
};

const toAttributeValue = (value: unknown): AttributeValue => {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

class RedactingLogProcessor implements LogRecordProcessor {
  public constructor(private readonly inner: LogRecordProcessor) {}

  public onEmit(logRecord: SdkLogRecord, context: Context): void {
    const workspaceContext = getWorkspaceContext();
    if (workspaceContext.workspaceId && logRecord.setAttribute) {
      logRecord.setAttribute('workspace_id', workspaceContext.workspaceId);
    }

    const attributes = (logRecord.attributes ?? {}) as Attributes;
    const mutableAttributes = attributes as Record<string, AttributeValue>;

    const contextPayload = mutableAttributes.context;
    if (contextPayload && typeof logRecord.body === 'string') {
      logRecord.body = `${logRecord.body} ${JSON.stringify({ context: contextPayload })}`;
    }

    for (const key of Object.keys(mutableAttributes)) {
      if (!allowedLabelKeys.has(key) || forbiddenLabelKeys.has(key)) {
        delete mutableAttributes[key];
        continue;
      }
      mutableAttributes[key] = toAttributeValue(redactValue(mutableAttributes[key]));
    }

    if (logRecord.setAttribute) {
      for (const [key, value] of Object.entries(mutableAttributes)) {
        logRecord.setAttribute(key, value);
      }
    }

    this.inner.onEmit(logRecord, context);
  }

  public forceFlush(): Promise<void> {
    return this.inner.forceFlush();
  }

  public shutdown(): Promise<void> {
    return this.inner.shutdown();
  }
}

export interface OtelConfig {
  serviceName: string;
  environment?: string;
  otlpEndpoint?: string;
  logLevel?: DiagLogLevel;
}

export const createOtelSdk = (config: OtelConfig): NodeSDK => {
  const otlpEndpoint =
    config.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

  if (config.logLevel !== undefined) {
    diag.setLogger(new DiagConsoleLogger(), config.logLevel);
  }

  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment ?? process.env.NODE_ENV ?? 'development'
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`
  });

  const logExporter = new OTLPLogExporter({
    url: `${otlpEndpoint}/v1/logs`
  });

  // Optimiere BatchLogRecordProcessor für schnelle Log-Übertragung
  // In Development: Kurze Delays für sofortige Sichtbarkeit
  // In Production: Längere Delays für bessere Batching Performance
  const isDevMode = config.environment === 'development';
  const batchSize = isDevMode ? 10 : 512;
  const scheduleDelayMs = isDevMode ? 500 : 5000; // 500ms in dev vs 5s in prod
  const expoTimeoutMs = isDevMode ? 10000 : 30000;

  const logProcessor = new RedactingLogProcessor(
    new BatchLogRecordProcessor(logExporter, {
      maxQueueSize: 4096,
      maxExportBatchSize: batchSize,
      scheduledDelayMillis: scheduleDelayMs,
      exportTimeoutMillis: expoTimeoutMs
    })
  );

  return new NodeSDK({
    resource,
    // Disable trace exporter - we only use logs and metrics
    // This prevents 404 errors when collector has no traces pipeline
    traceExporter: undefined,
    spanProcessors: [], // Explicitly no span processors
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter
    }),
    logRecordProcessor: logProcessor,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          enabled: true
        }
      })
    ]
  });
};

export const startOtelSdk = async (config: OtelConfig): Promise<NodeSDK> => {
  const sdk = createOtelSdk(config);
  await sdk.start();

  // Get global logger provider from OTEL API after SDK started
  // Note: Type casting needed as API logs and SDK logs use different LoggerProvider types at runtime
  // but they are compatible (the API returns what SDK expects)
  const globalLoggerProvider = logs.getLoggerProvider() as any;
  if (globalLoggerProvider) {
    setGlobalLoggerProvider(globalLoggerProvider);
  }

  return sdk;
};
