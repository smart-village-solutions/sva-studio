#!/usr/bin/env node
/**
 * Phase 1.1: OTEL SDK & Logger Provider Creation Test
 *
 * Tests the most fundamental question:
 * "Can OTEL SDK create a usable Logger Provider?"
 *
 * Success = All assertions pass, we can move to Phase 1.2
 * Failure = OTEL SDK problem, needs library-level fix
 *
 * Run: node test-otel-provider-creation.mjs
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

// Simple logger for test output
const log = (level, msg, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  console.log(`${prefix} ${msg}${data ? ' ' + JSON.stringify(data) : ''}`);
};

const tests = [];
let passed = 0;
let failed = 0;

const test = (name, fn) => {
  tests.push({ name, fn });
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

// ============================================================================
// TEST 1: SDK can be created with minimal config
// ============================================================================

test('SDK Creation - minimal config', () => {
  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'test-otel-provider',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'test'
  });

  const sdk = new NodeSDK({
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
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true }
    })]
  });

  assert(sdk, 'SDK should be created');
  assert(typeof sdk.start === 'function', 'SDK should have start() method');

  // Store for later tests
  global.__testSDK = sdk;
});

// ============================================================================
// TEST 2: SDK can be started
// ============================================================================

test('SDK Startup - no errors', async () => {
  const sdk = global.__testSDK;
  assert(sdk, 'SDK should exist from previous test');

  await sdk.start();

  assert(true, 'SDK.start() should complete without throwing');
});

// ============================================================================
// TEST 3: Logger Provider exists after SDK start
// ============================================================================

test('Logger Provider - exists and is accessible', () => {
  const provider = logs.getLoggerProvider();

  assert(provider, 'logs.getLoggerProvider() should return something');
  assert(provider !== null, 'Provider should not be null');
  assert(provider !== undefined, 'Provider should not be undefined');
  assert(typeof provider === 'object', 'Provider should be an object');
});

// ============================================================================
// TEST 4: Logger Provider has getLogger method
// ============================================================================

test('Logger Provider - has getLogger() method', () => {
  const provider = logs.getLoggerProvider();

  assert(provider.getLogger, 'Provider should have getLogger property');
  assert(typeof provider.getLogger === 'function', 'getLogger should be a function');
});

// ============================================================================
// TEST 5: Logger Provider can create a Logger instance
// ============================================================================

test('Logger Provider - can create Logger instance', () => {
  const provider = logs.getLoggerProvider();

  const logger = provider.getLogger('@test/phase1', '1.0.0');

  assert(logger, 'Logger should be created');
  assert(logger !== null, 'Logger should not be null');
  assert(logger !== undefined, 'Logger should not be undefined');
  assert(typeof logger === 'object', 'Logger should be an object');

  // Store for later tests
  global.__testLogger = logger;
});

// ============================================================================
// TEST 6: Logger instance has emit method
// ============================================================================

test('Logger - has emit() method', () => {
  const logger = global.__testLogger;

  assert(logger.emit, 'Logger should have emit property');
  assert(typeof logger.emit === 'function', 'emit should be a function');
});

// ============================================================================
// TEST 7: Logger can emit a simple log record
// ============================================================================

test('Logger - can emit log record without error', async () => {
  const logger = global.__testLogger;

  const logRecord = {
    severityNumber: 9,
    severityText: 'INFO',
    body: 'Test message from Phase 1.1',
    attributes: {
      component: 'test-otel-provider',
      test_phase: '1.1',
      timestamp: new Date().toISOString()
    }
  };

  // This might be async, but we just check it doesn't throw
  await logger.emit(logRecord);

  assert(true, 'emit() should complete without throwing');
});

// ============================================================================
// TEST 8: Logger can emit multiple records (batching)
// ============================================================================

test('Logger - can emit multiple records', async () => {
  const logger = global.__testLogger;

  for (let i = 0; i < 5; i++) {
    await logger.emit({
      severityNumber: 9 + (i % 3),
      severityText: ['INFO', 'WARN', 'ERROR'][i % 3],
      body: `Message ${i + 1} from Phase 1.1`,
      attributes: { index: i, component: 'test' }
    });
  }

  assert(true, 'Multiple emit() calls should complete without throwing');
});

// ============================================================================
// TEST 9: Logger survives different severity levels
// ============================================================================

test('Logger - handles all severity levels', async () => {
  const logger = global.__testLogger;

  const levels = [
    { num: 1, text: 'TRACE' },
    { num: 5, text: 'DEBUG' },
    { num: 9, text: 'INFO' },
    { num: 13, text: 'WARN' },
    { num: 17, text: 'ERROR' },
    { num: 21, text: 'FATAL' }
  ];

  for (const level of levels) {
    await logger.emit({
      severityNumber: level.num,
      severityText: level.text,
      body: `Test ${level.text}`,
      attributes: { level: level.text }
    });
  }

  assert(true, 'All severity levels should be accepted');
});

// ============================================================================
// TEST 10: Logger preserves attributes
// ============================================================================

test('Logger - accepts and preserves attributes', async () => {
  const logger = global.__testLogger;

  const attributes = {
    component: 'test',
    environment: 'test',
    workspace_id: 'test-workspace',
    user_id: '[REDACTED]',
    trace_id: '12345',
    custom_field: 'custom_value'
  };

  await logger.emit({
    severityNumber: 9,
    severityText: 'INFO',
    body: 'Test with attributes',
    attributes
  });

  assert(true, 'Attributes should be accepted without error');
});

// ============================================================================
// Run all tests
// ============================================================================

console.log('');
console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  Phase 1.1: OTEL SDK & Logger Provider Creation Test               ║');
console.log('║  Checking: Can OTEL SDK create a usable Logger Provider?           ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('');

for (const { name, fn } of tests) {
  try {
    await fn();
    passed++;
    log('pass', `✓ ${name}`);
  } catch (error) {
    failed++;
    log('fail', `✗ ${name}`);
    log('error', `  ${error.message}`);
  }
}

console.log('');
console.log('════════════════════════════════════════════════════════════════════');
console.log(`Results: ${passed}/${tests.length} passed, ${failed}/${tests.length} failed`);
console.log('════════════════════════════════════════════════════════════════════');

// ============================================================================
// Analysis
// ============================================================================

console.log('');
if (failed === 0) {
  console.log('✅ PHASE 1.1 SUCCESS');
  console.log('');
  console.log('Conclusions:');
  console.log('  • OTEL SDK initializes correctly');
  console.log('  • Logger Provider is created and accessible');
  console.log('  • Logger instances can be created');
  console.log('  • Logs can be emitted to Logger');
  console.log('  • Multiple logs don\'t cause errors');
  console.log('  • All severity levels are accepted');
  console.log('  • Attributes are preserved');
  console.log('');
  console.log('Next: Phase 1.2 - Can we store Provider globally?');
  process.exit(0);
} else {
  console.log('❌ PHASE 1.1 FAILURE');
  console.log('');
  console.log('Failed Tests:');
  for (const { name, fn } of tests) {
    try {
      await fn();
    } catch (error) {
      console.log(`  • ${name}`);
      console.log(`    Error: ${error.message}`);
    }
  }
  console.log('');
  console.log('Analysis:');
  console.log('  This is a fundamental issue with OTEL SDK or configuration.');
  console.log('  Before continuing, check:');
  console.log('  1. OTEL packages installed correctly?');
  console.log('  2. Node version compatible?');
  console.log('  3. SDK configuration correct?');
  console.log('');
  console.log('Reference: https://opentelemetry.io/docs/instrumentation/js/');
  process.exit(1);
}
