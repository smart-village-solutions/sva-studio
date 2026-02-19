import type { WorkspaceContext } from './context.server';

type LoggerProvider = {
  getLogger?: (name: string, version?: string) => {
    emit?: (payload: unknown) => void;
  };
} | null;

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
  getGlobalLoggerProvider: () => LoggerProvider;
  setGlobalLoggerProvider: (provider: LoggerProvider) => void;
};

let monitoringServerModulePromise: Promise<MonitoringServerModule> | null = null;
let monitoringLoggerProviderModulePromise: Promise<MonitoringLoggerProviderModule> | null = null;

const loadMonitoringServerModule = async (): Promise<MonitoringServerModule> => {
  if (!monitoringServerModulePromise) {
    monitoringServerModulePromise = import('@sva/monitoring-client/server') as Promise<MonitoringServerModule>;
  }
  return monitoringServerModulePromise;
};

const loadMonitoringLoggerProviderModule = async (): Promise<MonitoringLoggerProviderModule> => {
  if (!monitoringLoggerProviderModulePromise) {
    monitoringLoggerProviderModulePromise = import(
      '@sva/monitoring-client/logger-provider.server'
    ) as Promise<MonitoringLoggerProviderModule>;
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

export const getGlobalLoggerProviderFromMonitoring = async (): Promise<LoggerProvider> => {
  const module = await loadMonitoringLoggerProviderModule();
  return module.getGlobalLoggerProvider();
};

export const setGlobalLoggerProviderForMonitoring = async (
  provider: LoggerProvider
): Promise<void> => {
  const module = await loadMonitoringLoggerProviderModule();
  module.setGlobalLoggerProvider(provider);
};
