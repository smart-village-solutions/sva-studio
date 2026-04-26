import { createBrowserLogger, type BrowserLogLevel, type BrowserLogger } from '@sva/monitoring-client/logging';

export type BrowserOperationLogMeta = Readonly<{
  operation?: string;
  instance_id?: string;
  request_id?: string;
  trace_id?: string;
  status?: string | number;
  error_code?: string;
  error_message?: string;
  result?: string;
}> &
  Record<string, unknown>;

type ErrorWithMeta = {
  status?: unknown;
  code?: unknown;
  requestId?: unknown;
  message?: unknown;
};

export const createOperationLogger = (component: string, level: BrowserLogLevel = 'info'): BrowserLogger =>
  createBrowserLogger({ component, level });

export const buildBrowserErrorMeta = (
  error: unknown,
  meta: BrowserOperationLogMeta = {}
): BrowserOperationLogMeta => {
  const candidate = error && typeof error === 'object' ? (error as ErrorWithMeta) : undefined;

  return {
    ...meta,
    ...(typeof candidate?.status === 'number' ? { status: candidate.status } : {}),
    ...(typeof candidate?.code === 'string' ? { error_code: candidate.code } : {}),
    ...(typeof candidate?.requestId === 'string' ? { request_id: candidate.requestId } : {}),
    error_message:
      typeof candidate?.message === 'string'
        ? candidate.message
        : error instanceof Error
          ? error.message
          : String(error),
  };
};

export const logBrowserOperationStart = (
  logger: BrowserLogger,
  eventName: string,
  meta: BrowserOperationLogMeta = {}
): void => {
  logger.debug(eventName, {
    result: 'started',
    ...meta,
  });
};

export const logBrowserOperationSuccess = (
  logger: BrowserLogger,
  eventName: string,
  meta: BrowserOperationLogMeta = {},
  level: Extract<BrowserLogLevel, 'debug' | 'info'> = 'info'
): void => {
  logger[level](eventName, {
    result: 'succeeded',
    ...meta,
  });
};

export const logBrowserOperationAbort = (
  logger: BrowserLogger,
  eventName: string,
  meta: BrowserOperationLogMeta = {}
): void => {
  logger.debug(eventName, {
    result: 'aborted',
    ...meta,
  });
};

export const logBrowserOperationFailure = (
  logger: BrowserLogger,
  eventName: string,
  error: unknown,
  meta: BrowserOperationLogMeta = {},
  level: Extract<BrowserLogLevel, 'warn' | 'error'> = 'warn'
): void => {
  logger[level](
    eventName,
    buildBrowserErrorMeta(error, {
      result: 'failed',
      ...meta,
    })
  );
};
