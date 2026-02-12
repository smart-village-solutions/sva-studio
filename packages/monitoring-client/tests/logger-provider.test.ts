import { describe, it, expect, afterEach, vi } from 'vitest';
import { logs } from '@opentelemetry/api-logs';
import { LoggerProvider } from '@opentelemetry/sdk-logs';
import { getGlobalLoggerProvider, setGlobalLoggerProvider } from '../src/logger-provider.server';

describe('OTEL Logger Provider Integration', () => {
  afterEach(() => {
    // Clear global provider after each test
    setGlobalLoggerProvider(null as any);
  });

  describe('Logger Provider Storage', () => {
    it('should store and retrieve global logger provider', () => {
      // Create a mock provider
      const mockProvider = {
        getLogger: vi.fn(() => ({
          emit: vi.fn(),
        })),
      };

      // Store it
      setGlobalLoggerProvider(mockProvider);

      // Retrieve it
      const retrieved = getGlobalLoggerProvider();

      // Should be the same instance
      expect(retrieved).toBe(mockProvider);
    });

    it('should return null when no provider is set', () => {
      const provider = getGlobalLoggerProvider();
      expect(provider).toBeNull();
    });

    it('should handle multiple sets and gets', () => {
      const provider1 = { getLogger: vi.fn() };
      const provider2 = { getLogger: vi.fn() };

      setGlobalLoggerProvider(provider1);
      expect(getGlobalLoggerProvider()).toBe(provider1);

      setGlobalLoggerProvider(provider2);
      expect(getGlobalLoggerProvider()).toBe(provider2);
    });
  });

  describe('OTEL SDK Logger Provider Availability', () => {
    it('should have access to OTEL API logs module', () => {
      // This verifies the @opentelemetry/api-logs package is available
      expect(logs).toBeDefined();
      expect(typeof logs.getLoggerProvider).toBe('function');
    });

    it('should return a valid logger provider from OTEL API', () => {
      // Get the global provider from OTEL API
      const provider = logs.getLoggerProvider();

      // Should be a LoggerProvider instance
      expect(provider).toBeDefined();
      expect(typeof provider.getLogger).toBe('function');
    });

    it('should create a working logger instance', () => {
      const provider = logs.getLoggerProvider();
      const logger = provider.getLogger('@sva/test', '1.0.0');

      expect(logger).toBeDefined();
      expect(typeof logger.emit).toBe('function');
    });
  });
});
