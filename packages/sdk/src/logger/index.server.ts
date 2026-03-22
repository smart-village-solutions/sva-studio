import winston, { type Logger, type Logform } from 'winston';
import Transport from 'winston-transport';
import type { OtelLogRecord, OtelLogger } from './otel-logger.types.js';

import { getWorkspaceContext } from '../observability/context.server.js';
import { getGlobalLoggerProviderFromMonitoring } from '../observability/monitoring-client.bridge.server.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'api_key',
  'secret',
  'email',
  'cookie',
  'set-cookie',
  'session',
  'csrf',
  'refresh_token',
  'access_token',
  'x-api-key',
  'x-csrf-token'
]);

const emailRegex = /([\w.%+-])([\w.%+-]*)(@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,})/g;

const maskEmail = (value: string): string => {
  return value.replace(emailRegex, (_, firstChar, _middle, domain) => `${firstChar}***${domain}`);
};

const redactValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return maskEmail(value);
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

export const createSdkLogger = ({
  component,
  environment = process.env.NODE_ENV ?? 'development',
  level = 'info',
  enableConsole = environment !== 'production',
  enableOtel = true
}: LoggerOptions): Logger => {
  const transportsArray: winston.transport[] = [];

  // Nutze direkten OTEL Transport (umgeht Winston-Instrumentation-Timing-Problem)
  if (enableOtel) {
    transportsArray.push(new DirectOtelTransport());
  }

  if (enableConsole) {
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

  return winston.createLogger({
    level,
    defaultMeta: {
      component,
      environment
    },
    format: winston.format.combine(winston.format.timestamp(), enrichWithContext(), redactSensitive(), winston.format.json()),
    transports: transportsArray
  });
};
