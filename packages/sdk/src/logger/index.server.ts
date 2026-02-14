import winston, { type Logger } from 'winston';
import Transport from 'winston-transport';

import { getWorkspaceContext } from '../observability/context.server';
import { getGlobalLoggerProvider } from '@sva/monitoring-client/server';

const sensitiveKeys = new Set([
  'password',
  'token',
  'authorization',
  'api_key',
  'secret',
  'email'
]);

const emailRegex = /([\w.%+-])([\w.%+-]*)(@[\w.-]+\.[A-Za-z]{2,})/g;

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

const redactObject = (value: Record<string, unknown>): Record<string, unknown> => {
  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    if (sensitiveKeys.has(key.toLowerCase())) {
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
  private otelLogger: any = null;
  private loggerAttempted = false;

  log(info: any, callback?: () => void) {
    // Winston-kompatible async operation mit setImmediate
    setImmediate(() => {
      // Lazy-Init: Versuche nur einmal, den Logger zu holen
      if (!this.otelLogger && !this.loggerAttempted) {
        this.loggerAttempted = true;
        try {
          // Hole den globalen Logger Provider
          const provider = getGlobalLoggerProvider();
          if (provider && typeof provider.getLogger === 'function') {
            this.otelLogger = provider.getLogger('@sva/winston', '1.0.0');
          }
        } catch (e) {
          // Provider noch nicht verfügbar - log wird dann über Console gesendet
          this.emit('error', e);
        }
      }

      // Wenn Logger verfügbar, sende Log
      if (this.otelLogger && this.otelLogger.emit) {
        try {
          const { timestamp, level, message, component, environment, workspace_id, context, ...rest } = info;

          // Map Winston level to OTEL severity
          const severityMap: Record<string, number> = {
            error: 17,
            warn: 13,
            info: 9,
            debug: 5,
            verbose: 1,
          };

          this.otelLogger.emit({
            severityNumber: severityMap[level] || 9,
            severityText: level.toUpperCase(),
            body: message,
            attributes: {
              component,
              environment,
              workspace_id,
              ...rest,
            },
          });
        } catch (e) {
          this.emit('error', e);
        }
      }

      if (callback) {
        callback();
      }
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
    transportsArray.push(new DirectOtelTransport() as any);
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
