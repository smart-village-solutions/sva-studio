/**
 * Phase 1.1: OTEL SDK & Logger Provider Creation Test
 *
 * Tests the most fundamental question:
 * "Can OTEL SDK create a usable Logger Provider?"
 *
 * Success = All tests pass, we can move to Phase 1.2
 * Failure = OTEL SDK problem, needs library-level fix
 *
 * Run: npx vitest run tests/phase1-provider-creation.test.ts
 */

import { describe, it, expect, afterAll } from 'vitest';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

describe('Phase 1.1: OTEL SDK & Logger Provider Creation', () => {
  let sdk: NodeSDK;
  let provider: any;
  let logger: any;

  describe('SDK Creation', () => {
    it('should create SDK with minimal config', () => {
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
          {
            maxQueueSize: 4096,
            maxExportBatchSize: 10,
            scheduledDelayMillis: 500
          }
        ),
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': { enabled: true }
          })
        ]
      });

      expect(sdk).toBeDefined();
      expect(typeof sdk.start).toBe('function');
    });

    it('should start SDK without errors', async () => {
      expect(sdk).toBeDefined();
      await sdk.start();
      // If we get here without throwing, test passes
      expect(true).toBe(true);
    });
  });

  describe('Logger Provider Access', () => {
    it('logs.getLoggerProvider() should return provider', () => {
      provider = logs.getLoggerProvider();
      expect(provider).toBeDefined();
      expect(provider).not.toBeNull();
      expect(typeof provider).toBe('object');
    });

    it('provider should have getLogger method', () => {
      expect(provider.getLogger).toBeDefined();
      expect(typeof provider.getLogger).toBe('function');
    });
  });

  describe('Logger Creation', () => {
    it('should create Logger instance via provider.getLogger()', () => {
      logger = provider.getLogger('@test/phase1', '1.0.0');
      expect(logger).toBeDefined();
      expect(logger).not.toBeNull();
      expect(typeof logger).toBe('object');
    });

    it('logger should have emit method', () => {
      expect(logger.emit).toBeDefined();
      expect(typeof logger.emit).toBe('function');
    });
  });

  describe('Logger Functionality', () => {
    it('should emit single log record without error', async () => {
      const logRecord = {
        severityNumber: 9,
        severityText: 'INFO',
        body: 'Test message from Phase 1.1',
        attributes: {
          component: 'test-otel-provider',
          test_phase: '1.1'
        }
      };

      expect(() => logger.emit(logRecord)).not.toThrow();
    });

    it('should emit multiple records without error', async () => {
      for (let i = 0; i < 5; i++) {
        const logRecord = {
          severityNumber: 9 + (i % 3),
          severityText: ['INFO', 'WARN', 'ERROR'][i % 3],
          body: `Message ${i + 1}`,
          attributes: { index: i, component: 'test' }
        };
        expect(() => logger.emit(logRecord)).not.toThrow();
      }
    });

    it('should handle all severity levels', async () => {
      const levels = [
        { num: 1, text: 'TRACE' },
        { num: 5, text: 'DEBUG' },
        { num: 9, text: 'INFO' },
        { num: 13, text: 'WARN' },
        { num: 17, text: 'ERROR' },
        { num: 21, text: 'FATAL' }
      ];

      for (const level of levels) {
        const logRecord = {
          severityNumber: level.num,
          severityText: level.text,
          body: `Test ${level.text}`,
          attributes: { level: level.text }
        };
        expect(() => logger.emit(logRecord)).not.toThrow();
      }
    });

    it('should accept attributes on log records', async () => {
      const attributes = {
        component: 'test',
        environment: 'test',
        workspace_id: 'test-workspace',
        trace_id: '12345',
        custom_field: 'custom_value'
      };

      const logRecord = {
        severityNumber: 9,
        severityText: 'INFO',
        body: 'Test with attributes',
        attributes
      };

      expect(() => logger.emit(logRecord)).not.toThrow();
    });
  });

  describe('Provider Consistency', () => {
    it('should return same provider on subsequent calls', () => {
      const provider2 = logs.getLoggerProvider();
      expect(provider2).toBe(provider);
    });

    it('should allow creating multiple loggers', () => {
      const logger2 = provider.getLogger('@test/phase1-logger2', '1.0.0');
      const logger3 = provider.getLogger('@test/phase1-logger3', '1.0.0');

      expect(logger2).toBeDefined();
      expect(logger3).toBeDefined();
      expect(typeof logger2.emit).toBe('function');
      expect(typeof logger3.emit).toBe('function');
    });
  });

  afterAll(async () => {
    // Cleanup
    if (sdk) {
      await sdk.shutdown();
    }
  });
});
