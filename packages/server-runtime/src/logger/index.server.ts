import winston, { type Logger, type Logform } from 'winston';
import Transport from 'winston-transport';
import type { OtelLogRecord, OtelLogger } from './otel-logger.types.js';
import type { DevelopmentLogJsonValue } from './dev-log-buffer.server.js';

import { getWorkspaceContext } from '../observability/context.server.js';
import { getGlobalLoggerProviderFromMonitoring } from '../observability/monitoring-client.bridge.server.js';
import { appendDevelopmentLogEntry } from './dev-log-buffer.server.js';
import {
  getLoggingRuntimeConfig,
  isOtelRuntimeReady,
  isOtelRuntimePending,
  registerOtelAwareLogger,
  unregisterOtelAwareLogger,
} from './logging-runtime.server.js';
import { redactLogMeta, serializeAndRedactLogValue } from '../logging/redaction.js';

export const redactObject = (value: Record<string, unknown>): Record<string, unknown> => {
  return redactLogMeta(value);
};

const normalizeDevelopmentUiContext = (
  context: unknown
): Record<string, DevelopmentLogJsonValue> | undefined => {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return undefined;
  }

  const serializedContext = serializeAndRedactLogValue(context);
  if (!serializedContext || typeof serializedContext !== 'object' || Array.isArray(serializedContext)) {
    return undefined;
  }

  return serializedContext as Record<string, DevelopmentLogJsonValue>;
};

const enrichWithContext = winston.format((info) => {
  const context = getWorkspaceContext();

  if (context.workspaceId && !info.workspace_id) {
    info.workspace_id = context.workspaceId;
  }
  const existingContext = typeof info.context === 'object' && info.context ? (info.context as Record<string, unknown>) : {};
  const nextContext: Record<string, unknown> = { ...existingContext };

  if (context.requestId && !nextContext.request_id) {
    nextContext.request_id = context.requestId;
  }
  if (context.traceId && !nextContext.trace_id) {
    nextContext.trace_id = context.traceId;
  }
  if (context.userId && !nextContext.user_id) {
    nextContext.user_id = context.userId;
  }
  if (context.sessionId && !nextContext.session_id) {
    nextContext.session_id = context.sessionId;
  }

  if (Object.keys(nextContext).length > 0) {
    info.context = nextContext;
  }

  return info;
});

const redactSensitive = winston.format((info) => {
  const sanitized = redactObject(info as Record<string, unknown>);
  Object.assign(info, sanitized);
  return info;
});

export interface LoggerOptions {
  component: string;
  environment?: string;
  level?: string;
  enableConsole?: boolean;
  enableOtel?: boolean;
}

class DirectOtelTransport extends Transport {
  private otelLogger: OtelLogger | null = null;

  log(info: Logform.TransformableInfo, callback?: () => void) {
    setImmediate(() => {
      void (async () => {
        if (!this.otelLogger) {
          try {
            const provider = await getGlobalLoggerProviderFromMonitoring();
            if (provider && typeof provider.getLogger === 'function') {
              this.otelLogger = provider.getLogger('@sva/winston', '1.0.0');
            }
          } catch (e) {
            this.emit('error', e);
          }
        }

        if (this.otelLogger) {
          try {
            const { level, message, component, environment, workspace_id, context, ...rest } = info;
            const severityMap: Record<string, OtelLogRecord['severityNumber']> = {
              error: 17,
              warn: 13,
              info: 9,
              debug: 5,
              verbose: 1,
            };

            const normalizedLevel = typeof level === 'string' ? level : 'info';
            const normalizedMessage = typeof message === 'string' ? message : String(message);

            this.otelLogger.emit({
              severityNumber: severityMap[normalizedLevel] || 9,
              severityText: normalizedLevel.toUpperCase(),
              body: normalizedMessage,
              attributes: {
                level: normalizedLevel,
                component,
                environment,
                workspace_id,
                context: context ?? {},
                ...rest,
              },
            });
          } catch (e) {
            this.emit('error', e);
          }
        }
      })().finally(() => {
        if (callback) {
          callback();
        }
      });
    });
  }
}

class DevelopmentUiTransport extends Transport {
  log(info: Logform.TransformableInfo, callback?: () => void) {
    setImmediate(() => {
      const { level, message, component, context, timestamp } = info;

      appendDevelopmentLogEntry({
        timestamp: typeof timestamp === 'string' ? timestamp : new Date().toISOString(),
        level: (typeof level === 'string' ? level : 'info') as 'debug' | 'info' | 'warn' | 'error' | 'verbose',
        source: 'server',
        message: typeof message === 'string' ? message : String(message),
        component: typeof component === 'string' ? component : undefined,
        context: normalizeDevelopmentUiContext(context),
      });

      callback?.();
    });
  }
}

const patchLoggerCloseForRegistryCleanup = (logger: Logger, cleanup: () => void): void => {
  const originalClose = logger.close.bind(logger);
  let cleanedUp = false;

  logger.close = (() => {
    if (!cleanedUp) {
      cleanup();
      cleanedUp = true;
    }

    return originalClose();
  }) as typeof logger.close;
};

let hasReportedMissingTransport = false;

const resolveEffectiveLoggingMode = (input: {
  readonly consoleEnabled: boolean;
  readonly otelEnabled: boolean;
}): 'console_to_loki' | 'otel_to_loki' | 'degraded' => {
  if (input.otelEnabled) {
    return 'otel_to_loki';
  }
  if (input.consoleEnabled) {
    return 'console_to_loki';
  }
  return 'degraded';
};

const buildConsoleTransport = (environment: string, emergencyFallback = false): winston.transport => {
  if (environment === 'development' && !emergencyFallback) {
    return new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        enrichWithContext(),
        redactSensitive(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
          return `${timestamp} ${level}: ${message} ${metaString}`.trim();
        })
      )
    });
  }

  return new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      enrichWithContext(),
      redactSensitive(),
      winston.format.json()
    ),
  });
};

export const createSdkLogger = ({
  component,
  environment = process.env.NODE_ENV ?? 'development',
  level = 'info',
  enableConsole,
  enableOtel
}: LoggerOptions): Logger => {
  const runtimeConfig = getLoggingRuntimeConfig();
  const consoleEnabled = enableConsole ?? runtimeConfig.consoleEnabled;
  const otelEnabled = enableOtel ?? runtimeConfig.otelRequested;
  const loggingMode = resolveEffectiveLoggingMode({
    consoleEnabled,
    otelEnabled,
  });
  const transportsArray: winston.transport[] = [];
  let otelTransport: DirectOtelTransport | null = null;

  if (otelEnabled && isOtelRuntimeReady()) {
    otelTransport = new DirectOtelTransport();
    transportsArray.push(otelTransport);
  }

  if (runtimeConfig.uiEnabled) {
    transportsArray.push(new DevelopmentUiTransport());
  }

  if (consoleEnabled) {
    transportsArray.push(buildConsoleTransport(environment));
  }

  if (transportsArray.length === 0) {
    transportsArray.push(buildConsoleTransport(environment, true));
  }

  const logger = winston.createLogger({
    level,
    defaultMeta: {
      component,
      environment,
      logging_mode: loggingMode,
    },
    format: winston.format.combine(winston.format.timestamp(), enrichWithContext(), redactSensitive(), winston.format.json()),
    transports: transportsArray
  });

  if (!consoleEnabled && !otelEnabled && !hasReportedMissingTransport) {
    hasReportedMissingTransport = true;
    logger.error('Observability degraded: logger started without configured transport; emergency console fallback enabled', {
      operation: 'observability_bootstrap',
      error_type: 'logger_transport_missing',
      logger_mode: 'degraded',
      otel_requested: otelEnabled,
      console_enabled: consoleEnabled,
    });
  }

  if (otelEnabled && isOtelRuntimePending()) {
    registerOtelAwareLogger({
      logger,
      otelEnabled,
      syncOtelTransport: (ready) => {
        if (ready && !otelTransport) {
          otelTransport = new DirectOtelTransport();
          logger.add(otelTransport);
          return;
        }

        if (!ready && otelTransport) {
          logger.remove(otelTransport);
          otelTransport = null;
        }
      },
    });

    patchLoggerCloseForRegistryCleanup(logger, () => {
      unregisterOtelAwareLogger(logger);
    });
  }

  return logger;
};
