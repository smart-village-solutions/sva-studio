import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setGlobalLoggerProvider, getGlobalLoggerProvider } from '@sva/monitoring-client/server';

/**
 * Test suite for DirectOtelTransport
 * Verifies that the transport can connect to a Logger Provider and emit logs
 */
describe('DirectOtelTransport', () => {
  beforeEach(() => {
    // Clear global state
    setGlobalLoggerProvider(null as any);
  });

  it('should connect to global logger provider on first log', () => {
    // Create mock provider
    const mockEmit = vi.fn();
    const mockLogger = {
      emit: mockEmit,
    };

    const mockProvider = {
      getLogger: vi.fn(() => mockLogger),
    };

    setGlobalLoggerProvider(mockProvider);

    // Import and use DirectOtelTransport
    const { createSdkLogger } = require('../src/logger/index.server');
    const logger = createSdkLogger({
      component: 'test',
      enableOtel: true,
      enableConsole: false,
    });

    // Log a message
    logger.info('Test message', { test_data: 'value' });

    // Transport should have called getLogger on provider
    expect(mockProvider.getLogger).toHaveBeenCalledWith('@sva/winston', '1.0.0');

    // Logger.emit should have been called
    expect(mockEmit).toHaveBeenCalled();
  });

  it('should map log levels correctly to OTEL severity', () => {
    const mockEmit = vi.fn();
    const mockLogger = {
      emit: mockEmit,
    };

    const mockProvider = {
      getLogger: vi.fn(() => mockLogger),
    };

    setGlobalLoggerProvider(mockProvider);

    const { createSdkLogger } = require('../src/logger/index.server');
    const logger = createSdkLogger({
      component: 'test',
      enableOtel: true,
      enableConsole: false,
    });

    // Test different log levels
    logger.error('Error message');
    logger.warn('Warn message');
    logger.info('Info message');

    // Should have 3 emits (one per log level)
    expect(mockEmit).toHaveBeenCalledTimes(3);

    // Check severity mapping
    const calls = mockEmit.mock.calls;
    expect(calls[0][0].severityNumber).toBe(17); // error
    expect(calls[1][0].severityNumber).toBe(13); // warn
    expect(calls[2][0].severityNumber).toBe(9); // info
  });

  it('should handle missing provider gracefully', () => {
    // No provider set
    const { createSdkLogger } = require('../src/logger/index.server');
    const logger = createSdkLogger({
      component: 'test',
      enableOtel: true,
      enableConsole: false,
    });

    // Should not throw
    expect(() => {
      logger.info('Test message');
    }).not.toThrow();
  });

  it('should preserve log attributes through OTEL emit', () => {
    const capturedRecord = { emit: vi.fn() };
    let emittedData: any = null;

    const mockEmit = vi.fn((data) => {
      emittedData = data;
    });

    const mockLogger = {
      emit: mockEmit,
    };

    const mockProvider = {
      getLogger: vi.fn(() => mockLogger),
    };

    setGlobalLoggerProvider(mockProvider);

    const { createSdkLogger } = require('../src/logger/index.server');
    const logger = createSdkLogger({
      component: 'test-component',
      environment: 'test',
      enableOtel: true,
      enableConsole: false,
    });

    logger.info('Test message', {
      custom_data: 'custom_value',
      request_id: 'req-123',
    });

    // Verify emitted data
    expect(emittedData).toBeDefined();
    expect(emittedData.body).toContain('Test message');
    expect(emittedData.severityText).toBe('INFO');
    expect(emittedData.attributes.component).toBe('test-component');
  });
});
