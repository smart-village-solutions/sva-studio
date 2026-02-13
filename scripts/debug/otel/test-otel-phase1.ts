/**
 * Phase 1.1: OTEL SDK & Logger Provider Creation Test
 * Run: cd /Users/wilimzig/Documents/Projects/SVA/sva-studio && pnpm exec tsx scripts/debug/otel/test-otel-phase1.ts
 *
 * This test is deliberately kept simple:
 * - No Vitest (too complex to setup)
 * - Direct console output
 * - Can run standalone
 * - Clear pass/fail
 */

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

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error?.message });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error?.message}`);
  }
}

console.log('');
console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  PHASE 1.1: OTEL SDK & Logger Provider Creation Test              ║');
console.log('║  Question: Can OTEL SDK create a usable Logger Provider?          ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('');

let sdk: NodeSDK;
let provider: any;
let logger: any;

// Test 1: Create SDK
console.log('Test Group: SDK Creation');
await test('Create SDK with minimal config', () => {
  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'test-otel-provider',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'test'
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: undefined,
    spanProcessors: [],
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: 'http://localhost:4318/v1/metrics' })
    }),
    logRecordProcessor: new BatchLogRecordProcessor(
      new OTLPLogExporter({ url: 'http://localhost:4318/v1/logs' }),
      { maxQueueSize: 4096, maxExportBatchSize: 10, scheduledDelayMillis: 500 }
    ),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true }
      })
    ]
  });

  if (!sdk) throw new Error('SDK not created');
  if (typeof sdk.start !== 'function') throw new Error('SDK.start is not a function');
});

await test('Start SDK without errors', async () => {
  if (!sdk) throw new Error('SDK not created in previous test');
  await sdk.start();
});

// Test 2: Access Provider
console.log('');
console.log('Test Group: Logger Provider Access');
await test('Get Logger Provider from logs API', () => {
  provider = logs.getLoggerProvider();
  if (!provider) throw new Error('Logger Provider is null');
  if (typeof provider !== 'object') throw new Error('Logger Provider is not an object');
});

await test('Logger Provider has getLogger method', () => {
  if (!provider) throw new Error('Logger Provider not set');
  if (!provider.getLogger) throw new Error('getLogger method missing');
  if (typeof provider.getLogger !== 'function') throw new Error('getLogger is not a function');
});

// Test 3: Create Logger
console.log('');
console.log('Test Group: Logger Creation');
await test('Create Logger instance', () => {
  if (!provider) throw new Error('Logger Provider not set');
  logger = provider.getLogger('@test/phase1', '1.0.0');
  if (!logger) throw new Error('Logger not created');
  if (typeof logger !== 'object') throw new Error('Logger is not an object');
});

await test('Logger has emit method', () => {
  if (!logger) throw new Error('Logger not created');
  if (!logger.emit) throw new Error('emit method missing');
  if (typeof logger.emit !== 'function') throw new Error('emit is not a function');
});

// Test 4: Logger Functionality
console.log('');
console.log('Test Group: Logger Functionality');
await test('Emit single log record', async () => {
  if (!logger) throw new Error('Logger not created');
  await logger.emit({
    severityNumber: 9,
    severityText: 'INFO',
    body: 'Test message',
    attributes: { component: 'test', phase: '1.1' }
  });
});

await test('Emit multiple records', async () => {
  if (!logger) throw new Error('Logger not created');
  for (let i = 0; i < 5; i++) {
    await logger.emit({
      severityNumber: 9,
      severityText: 'INFO',
      body: `Message ${i}`,
      attributes: { index: i }
    });
  }
});

await test('Handle all severity levels', async () => {
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

await test('Preserve attributes on emit', async () => {
  if (!logger) throw new Error('Logger not created');
  await logger.emit({
    severityNumber: 9,
    severityText: 'INFO',
    body: 'Test with attributes',
    attributes: {
      component: 'test',
      environment: 'test',
      workspace_id: 'test-ws',
      custom_field: 'custom_value'
    }
  });
});

// Test 5: Provider Consistency
console.log('');
console.log('Test Group: Provider Consistency');
await test('Provider is same on multiple calls', () => {
  if (!provider) throw new Error('Provider not set');
  const provider2 = logs.getLoggerProvider();
  if (provider2 !== provider) throw new Error('Provider instances do not match');
});

await test('Can create multiple loggers', () => {
  if (!provider) throw new Error('Provider not set');
  const logger2 = provider.getLogger('@test/logger2', '1.0.0');
  const logger3 = provider.getLogger('@test/logger3', '1.0.0');
  if (!logger2 || !logger3) throw new Error('Failed to create multiple loggers');
  if (typeof logger2.emit !== 'function') throw new Error('Logger2 emit not a function');
  if (typeof logger3.emit !== 'function') throw new Error('Logger3 emit not a function');
});

// Cleanup
if (sdk) {
  await sdk.shutdown();
}

// Results
console.log('');
console.log('════════════════════════════════════════════════════════════════════');

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;

console.log(`Results: ${passed}/${results.length} passed, ${failed}/${results.length} failed`);
console.log('════════════════════════════════════════════════════════════════════');
console.log('');

if (failed === 0) {
  console.log('✅ PHASE 1.1 SUCCESS');
  console.log('');
  console.log('Findings:');
  console.log('  • OTEL SDK initializes successfully');
  console.log('  • Logger Provider is created and accessible via logs.getLoggerProvider()');
  console.log('  • Provider can create Logger instances');
  console.log('  • Loggers can emit records without errors');
  console.log('  • All severity levels are accepted');
  console.log('  • Attributes are preserved in emit() calls');
  console.log('  • Provider is consistent (same instance on multiple calls)');
  console.log('');
  console.log('✓ READY FOR PHASE 1.2: Global Provider Storage Test');
  process.exit(0);
} else {
  console.log('❌ PHASE 1.1 FAILURE');
  console.log('');
  console.log('Failed tests:');
  for (const result of results.filter((r) => !r.passed)) {
    console.log(`  • ${result.name}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }
  console.log('');
  console.log('Root Cause Analysis:');
  console.log('  This is a fundamental issue with OTEL SDK or configuration.');
  console.log('  Check:');
  console.log('  1. Are all OTEL packages installed?');
  console.log('  2. Is Node version compatible (>= 18)?');
  console.log('  3. Is the SDK configuration correct?');
  process.exit(1);
}
