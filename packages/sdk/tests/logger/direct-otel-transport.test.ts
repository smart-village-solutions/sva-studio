import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setGlobalLoggerProviderForMonitoring } from '../../src/observability/monitoring-client.bridge.server';
import { createSdkLogger } from '../../src/logger/index.server';

/**
 * Test suite for DirectOtelTransport
 * Verifies that the transport can connect to a Logger Provider and emit logs
 */
describe('DirectOtelTransport', () => {
  const flushAsyncLogs = async () => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  beforeEach(() => {
    // Clear global state
    return setGlobalLoggerProviderForMonitoring(null);
  });

  it('should connect to global logger provider on first log', async () => {
    // Create mock provider
    const mockEmit = vi.fn();
    const mockLogger = {
      emit: mockEmit,
    };

    const mockProvider = {
      getLogger: vi.fn(() => mockLogger),
    };

    await setGlobalLoggerProviderForMonitoring(mockProvider);

    // Import and use DirectOtelTransport
    const logger = createSdkLogger({
      component: 'test',
      enableOtel: true,
      enableConsole: false,
    });

    // Log a message
    logger.info('Test message', { test_data: 'value' });
    await flushAsyncLogs();

    // Transport should have called getLogger on provider
    expect(mockProvider.getLogger).toHaveBeenCalledWith('@sva/winston', '1.0.0');

    // Logger.emit should have been called
    expect(mockEmit).toHaveBeenCalled();
  });

  it('should map log levels correctly to OTEL severity', async () => {
    const mockEmit = vi.fn();
    const mockLogger = {
      emit: mockEmit,
    };

    const mockProvider = {
      getLogger: vi.fn(() => mockLogger),
    };

    await setGlobalLoggerProviderForMonitoring(mockProvider);

    const logger = createSdkLogger({
      component: 'test',
      enableOtel: true,
      enableConsole: false,
    });

    // Test different log levels
    logger.error('Error message');
    await flushAsyncLogs();
    logger.warn('Warn message');
    await flushAsyncLogs();
    logger.info('Info message');
    await flushAsyncLogs();

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

  it('should preserve log attributes through OTEL emit', async () => {
    let emittedData: Record<string, unknown> | null = null;

    const mockEmit = vi.fn((data: Record<string, unknown>) => {
      emittedData = data;
    });

    const mockLogger = {
      emit: mockEmit,
    };

    const mockProvider = {
      getLogger: vi.fn(() => mockLogger),
    };

    await setGlobalLoggerProviderForMonitoring(mockProvider);

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
    await flushAsyncLogs();

    // Verify emitted data
    expect(emittedData).toBeDefined();
    expect(emittedData?.body).toContain('Test message');
    expect(emittedData?.severityText).toBe('INFO');
    expect((emittedData?.attributes as Record<string, unknown>).component).toBe('test-component');
  });
});
