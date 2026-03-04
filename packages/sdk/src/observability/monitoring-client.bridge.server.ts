import type { WorkspaceContext } from './context.server';
import type { OtelLoggerProvider } from '../logger/otel-logger.types';

type MonitoringServerModule = {
  setWorkspaceContextGetter: (getter: () => WorkspaceContext) => void;
  startOtelSdk: (config: {
    serviceName: string;
    environment?: string;
    otlpEndpoint?: string;
    logLevel?: number;
  }) => Promise<unknown>;
};

type MonitoringLoggerProviderModule = {
  getGlobalLoggerProvider: () => OtelLoggerProvider | null;
  setGlobalLoggerProvider: (provider: OtelLoggerProvider | null) => void;
};

let monitoringServerModulePromise: Promise<MonitoringServerModule> | null = null;
let monitoringLoggerProviderModulePromise: Promise<MonitoringLoggerProviderModule> | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object';
};

const isMonitoringServerModule = (value: unknown): value is MonitoringServerModule => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.setWorkspaceContextGetter === 'function' &&
    typeof value.startOtelSdk === 'function'
  );
};

const isMonitoringLoggerProviderModule = (value: unknown): value is MonitoringLoggerProviderModule => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.getGlobalLoggerProvider === 'function' &&
    typeof value.setGlobalLoggerProvider === 'function'
  );
};

const loadMonitoringServerModule = async (): Promise<MonitoringServerModule> => {
  if (!monitoringServerModulePromise) {
    monitoringServerModulePromise = import('@sva/monitoring-client/server').then((module) => {
      if (!isMonitoringServerModule(module)) {
        throw new Error(
          'Invalid monitoring server module shape: expected setWorkspaceContextGetter() and startOtelSdk()'
        );
      }
      return module;
    });
  }
  return monitoringServerModulePromise;
};

const loadMonitoringLoggerProviderModule = async (): Promise<MonitoringLoggerProviderModule> => {
  if (!monitoringLoggerProviderModulePromise) {
    monitoringLoggerProviderModulePromise = import(
      '@sva/monitoring-client/logger-provider.server'
    ).then((module) => {
      if (!isMonitoringLoggerProviderModule(module)) {
        throw new Error(
          'Invalid monitoring logger provider module shape: expected getGlobalLoggerProvider() and setGlobalLoggerProvider()'
        );
      }
      return module;
    });
  }
  return monitoringLoggerProviderModulePromise;
};

export const setWorkspaceContextGetterForMonitoring = async (
  getter: () => WorkspaceContext
): Promise<void> => {
  const module = await loadMonitoringServerModule();
  module.setWorkspaceContextGetter(getter);
};

export const startOtelSdkFromMonitoring = async (config: {
  serviceName: string;
  environment?: string;
  otlpEndpoint?: string;
  logLevel?: number;
}): Promise<unknown> => {
  const module = await loadMonitoringServerModule();
  return module.startOtelSdk(config);
};

export const getGlobalLoggerProviderFromMonitoring = async (): Promise<OtelLoggerProvider | null> => {
  const module = await loadMonitoringLoggerProviderModule();
  return module.getGlobalLoggerProvider();
};

export const setGlobalLoggerProviderForMonitoring = async (
  provider: OtelLoggerProvider | null
): Promise<void> => {
  const module = await loadMonitoringLoggerProviderModule();
  module.setGlobalLoggerProvider(provider);
};
