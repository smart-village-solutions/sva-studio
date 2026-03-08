import { logs } from '@opentelemetry/api-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, type Logger } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

type TestFn = () => void | Promise<void>;

interface RegisteredTest {
  name: string;
  fn: TestFn;
}

const tests: RegisteredTest[] = [];
let passed = 0;
let failed = 0;
let sdk: NodeSDK | undefined;
let logger: Logger | undefined;

const test = (name: string, fn: TestFn): void => {
  tests.push({ name, fn });
};

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

test('SDK Creation - minimal config', () => {
  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'test-otel-provider',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'test',
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: undefined,
    spanProcessors: [],
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: 'http://localhost:4318/v1/metrics' }),
    }),
    logRecordProcessor: new BatchLogRecordProcessor(
      new OTLPLogExporter({ url: 'http://localhost:4318/v1/logs' }),
      { maxQueueSize: 4096, maxExportBatchSize: 10, scheduledDelayMillis: 500 }
    ),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
      }),
    ],
  });

  assert(typeof sdk.start === 'function', 'SDK should have start() method');
});

test('SDK Startup - no errors', async () => {
  assert(sdk, 'SDK should exist from previous test');
  await sdk.start();
});

test('Logger Provider - exists and is accessible', () => {
  const provider = logs.getLoggerProvider();

  assert(provider, 'logs.getLoggerProvider() should return something');
  assert(typeof provider === 'object', 'Provider should be an object');
});

test('Logger Provider - has getLogger() method', () => {
  const provider = logs.getLoggerProvider();

  assert(typeof provider.getLogger === 'function', 'getLogger should be a function');
});

test('Logger Provider - can create Logger instance', () => {
  const provider = logs.getLoggerProvider();
  logger = provider.getLogger('@test/phase1', '1.0.0');

  assert(logger, 'Logger should be created');
  assert(typeof logger.emit === 'function', 'Logger should have emit()');
});

test('Logger - can emit log record without error', async () => {
  assert(logger, 'Logger should exist from previous test');

  await logger.emit({
    severityNumber: 9,
    severityText: 'INFO',
    body: 'Test message from Phase 1.1',
    attributes: {
      component: 'test-otel-provider',
      test_phase: '1.1',
      timestamp: new Date().toISOString(),
    },
  });
});

test('Logger - can emit multiple records', async () => {
  assert(logger, 'Logger should exist from previous test');

  for (let index = 0; index < 5; index += 1) {
    await logger.emit({
      severityNumber: 9 + (index % 3),
      severityText: ['INFO', 'WARN', 'ERROR'][index % 3] ?? 'INFO',
      body: `Message ${index + 1} from Phase 1.1`,
      attributes: { index, component: 'test' },
    });
  }
});

test('Logger - handles all severity levels', async () => {
  assert(logger, 'Logger should exist from previous test');

  const levels = [
    { num: 1, text: 'TRACE' },
    { num: 5, text: 'DEBUG' },
    { num: 9, text: 'INFO' },
    { num: 13, text: 'WARN' },
    { num: 17, text: 'ERROR' },
    { num: 21, text: 'FATAL' },
  ] as const;

  for (const level of levels) {
    await logger.emit({
      severityNumber: level.num,
      severityText: level.text,
      body: `Test ${level.text}`,
      attributes: { level: level.text },
    });
  }
});

const run = async (): Promise<void> => {
  console.log('Phase 1.1: OTEL SDK & Logger Provider Creation Test');
  console.log(`Running ${tests.length} checks...\n`);

  for (const currentTest of tests) {
    try {
      await currentTest.fn();
      passed += 1;
      console.log(`PASS ${currentTest.name}`);
    } catch (error: unknown) {
      failed += 1;
      console.error(`FAIL ${currentTest.name}`);
      console.error(error instanceof Error ? error.message : String(error));
    }
  }

  if (sdk) {
    await sdk.shutdown().catch(() => undefined);
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
};

void run();
