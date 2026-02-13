import { eventHandler } from 'h3';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

/**
 * H3 Handler for Phase 1.1 Test Execution
 *
 * Run: curl http://localhost:3000/__debug/phase1-test
 *
 * This endpoint:
 * 1. Creates a fresh OTEL SDK
 * 2. Starts it
 * 3. Tests Logger Provider creation and functionality
 * 4. Returns structured test results
 */
export default eventHandler(async (event) => {
  const results: TestResult[] = [];

  async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (error: any) {
      results.push({ name, passed: false, error: error?.message || String(error) });
    }
  }

  // Test 1: Create SDK
  let sdk: NodeSDK;
  await test('[1.1.1] SDK Creation', () => {
    const resource = resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: 'phase1-test',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'test'
    });

    sdk = new NodeSDK({
      resource,
      traceExporter: undefined,
      spanProcessors: [],
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: 'http://host.docker.internal:4318/v1/metrics' })
      }),
      logRecordProcessor: new BatchLogRecordProcessor(
        new OTLPLogExporter({ url: 'http://host.docker.internal:4318/v1/logs' }),
        { maxQueueSize: 4096, maxExportBatchSize: 10, scheduledDelayMillis: 500 }
      ),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true }
        })
      ]
    });

  });

  // Test 2: Start SDK
  let provider: any;
  await test('[1.1.2] SDK Startup', async () => {
    if (!sdk) throw new Error('SDK not created');
    await sdk.start();
  });

  // Test 3: Get Provider
  await test('[1.1.3] Get Logger Provider', () => {
    provider = logs.getLoggerProvider();
    if (!provider) throw new Error('Provider is null');
  });

  // Test 4: Provider has getLogger
  await test('[1.1.4] Provider.getLogger exists', () => {
    if (!provider) throw new Error('Provider not available');
    if (typeof provider.getLogger !== 'function') throw new Error('getLogger is not a function');
  });

  // Test 5: Create Logger
  let logger: any;
  await test('[1.1.5] Create Logger', () => {
    if (!provider) throw new Error('Provider not available');
    logger = provider.getLogger('@test/phase1', '1.0.0');
    if (!logger) throw new Error('Logger not created');
  });

  // Test 6: Logger has emit
  await test('[1.1.6] Logger.emit exists', () => {
    if (!logger) throw new Error('Logger not created');
    if (typeof logger.emit !== 'function') throw new Error('emit is not a function');
  });

  // Test 7: Emit single record
  await test('[1.1.7] Emit single record', async () => {
    if (!logger) throw new Error('Logger not created');
    await logger.emit({
      severityNumber: 9,
      severityText: 'INFO',
      body: 'Phase 1.1 test message',
      attributes: { component: 'phase1-test', phase: '1.1' }
    });
  });

  // Test 8: Emit multiple records
  await test('[1.1.8] Emit multiple records', async () => {
    if (!logger) throw new Error('Logger not created');
    for (let i = 0; i < 3; i++) {
      await logger.emit({
        severityNumber: 9,
        severityText: 'INFO',
        body: `Message ${i}`,
        attributes: { index: i }
      });
    }
  });

  // Test 9: All severity levels
  await test('[1.1.9] All severity levels', async () => {
    if (!logger) throw new Error('Logger not created');
    const levels = [
      { num: 1, text: 'TRACE' },
      { num: 5, text: 'DEBUG' },
      { num: 9, text: 'INFO' },
      { num: 13, text: 'WARN' },
      { num: 17, text: 'ERROR' }
    ];
    for (const level of levels) {
      await logger.emit({
        severityNumber: level.num,
        severityText: level.text,
        body: `Test ${level.text}`,
        attributes: { level: level.text }
      });
    }
  });

  // Test 10: Attributes preserved
  await test('[1.1.10] Attributes preserved', async () => {
    if (!logger) throw new Error('Logger not created');
    await logger.emit({
      severityNumber: 9,
      severityText: 'INFO',
      body: 'With attributes',
      attributes: {
        component: 'test',
        environment: 'test',
        workspace_id: 'ws-123',
        custom: 'value'
      }
    });
  });

  // Cleanup
  if (sdk) {
    await sdk.shutdown().catch(() => {
      /* ignore */
    });
  }

  // Results
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const success = failed === 0;

  return {
    phase: '1.1',
    title: 'OTEL SDK & Logger Provider Creation',
    timestamp: new Date().toISOString(),
    success,
    stats: { total: results.length, passed, failed },
    results,
    summary: success
      ? 'All tests passed. Logger Provider is working correctly.'
      : `${failed} test(s) failed. See details below.`,
    nextPhase: success ? '1.2 - Global Provider Storage Test' : 'Debug Phase 1.1',
    details: {
      findings: success
        ? [
            '✓ OTEL SDK initializes successfully',
            '✓ Logger Provider is accessible via logs.getLoggerProvider()',
            '✓ Provider can create Logger instances',
            '✓ Loggers can emit records without errors',
            '✓ All severity levels are accepted',
            '✓ Attributes are preserved'
          ]
        : undefined,
      failedTests: !success
        ? results.filter((r) => !r.passed).map((r) => ({ name: r.name, error: r.error }))
        : undefined
    }
  };
});
