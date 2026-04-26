export type {
  LoggingRuntimeConfig,
  OtelInitializationResult,
} from '@sva/server-runtime/logger/logging-runtime.server';
export {
  getLoggingRuntimeConfig,
  getOtelInitializationResult,
  getRegisteredOtelLoggerCountForTests,
  isOtelRuntimePending,
  isOtelRuntimeReady,
  registerOtelAwareLogger,
  resetLoggingRuntimeForTests,
  setOtelInitializationResult,
  unregisterOtelAwareLogger,
} from '@sva/server-runtime/logger/logging-runtime.server';
