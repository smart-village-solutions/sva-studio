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
import { maskEmailAddresses } from '@sva/core';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'api_key',
  'secret',
  'client_secret',
  'email',
  'cookie',
  'set-cookie',
  'session',
  'session_id',
  'user_id',
  'csrf',
  'refresh_token',
  'access_token',
  'id_token',
  'id_token_hint',
  'x-api-key',
  'x-csrf-token',
  'actor_user_id',
  'session_user_id',
  'actor_account_id',
  'keycloak_subject',
  'db_keycloak_subject'
]);

const jwtLikeRegex = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/g;
const querySecretRegexSource = String.raw`([?&](?:access_token|refresh_token|id_token|id_token_hint|token|code|client_secret|api_key|authorization)=)([^&#\s]+)`;
const inlineQuerySecretRegexSource = String.raw`((?:^|[\s,(])(?:access_token|refresh_token|id_token|id_token_hint|token|code|client_secret|api_key|authorization)[\w.-]{0,20}[=:]\s*)([^\s,)]+)`;
const inlineSensitiveFieldRegexSource = String.raw`((?:^|[\s,(])(?:password|secret|session|cookie|csrf)[\w.-]{0,20}[=:]\s*)([^\s,)]+)`;
const urlSecretPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(authorization:\s*)(bearer\s+)?[^\s,]+/gi, '$1[REDACTED]'],
  [/\b(bearer\s+)(?!\[REDACTED(?:_JWT)?\])[^\s,]+/gi, '$1[REDACTED]'],
  [new RegExp(querySecretRegexSource, 'gi'), '$1[REDACTED]'],
  [new RegExp(inlineQuerySecretRegexSource, 'gi'), '$1[REDACTED]'],
  [new RegExp(inlineSensitiveFieldRegexSource, 'gi'), '$1[REDACTED]'],
];

const redactSensitiveString = (value: string): string => {
  let next = maskEmailAddresses(value);
  next = next.replace(jwtLikeRegex, '[REDACTED_JWT]');
  for (const [pattern, replacement] of urlSecretPatterns) {
    next = next.replace(pattern, replacement);
  }
  return next;
};

const redactValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return redactSensitiveString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === 'object') {
    return redactObject(value as Record<string, unknown>);
  }
  return value;
};

export const redactObject = (value: Record<string, unknown>): Record<string, unknown> => {
  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      acc[key] = '[REDACTED]';
      return acc;
    }
    acc[key] = redactValue(entry);
    return acc;
  }, {});
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

/**
 * Custom Winston Transport der Logs direkt an den OTEL Logger Provider sendet.
 * Umgeht das Timing-Problem mit der Winston-Instrumentation.
 *
 * Nutzt winston-transport für vollständige Kompatibilität.
 */
class DirectOtelTransport extends Transport {
  private otelLogger: OtelLogger | null = null;

  log(info: Logform.TransformableInfo, callback?: () => void) {
    // Winston-kompatible async operation mit setImmediate
    setImmediate(() => {
      void (async () => {
        // Lazy-Init: Solange retryen, bis ein Logger Provider verfügbar ist.
        if (!this.otelLogger) {
          try {
            const provider = await getGlobalLoggerProviderFromMonitoring();
            if (provider && typeof provider.getLogger === 'function') {
              this.otelLogger = provider.getLogger('@sva/winston', '1.0.0');
            }
          } catch (e) {
            // Provider noch nicht verfügbar - log wird dann über Console gesendet
            this.emit('error', e);
          }
        }

        // Wenn Logger verfügbar, sende Log
        if (this.otelLogger) {
          try {
            const { level, message, component, environment, workspace_id, context, ...rest } = info;

            // Map Winston level to OTEL severity
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
      })()
        .finally(() => {
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
        context:
          typeof context === 'object' && context
            ? (context as Record<string, DevelopmentLogJsonValue>)
            : undefined,
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
    transportsArray.push(
      new winston.transports.Console({
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
      })
    );
  }

  const logger = winston.createLogger({
    level,
    defaultMeta: {
      component,
      environment
    },
    format: winston.format.combine(winston.format.timestamp(), enrichWithContext(), redactSensitive(), winston.format.json()),
    transports: transportsArray
  });

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
