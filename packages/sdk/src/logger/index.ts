import winston, { type Logger } from 'winston';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';

import { getWorkspaceContext } from '../observability/context';

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

export const createSdkLogger = ({
  component,
  environment = process.env.NODE_ENV ?? 'development',
  level = 'info',
  enableConsole = environment !== 'production',
  enableOtel = true
}: LoggerOptions): Logger => {
  const transports: winston.transport[] = [];

  if (enableOtel) {
    transports.push(new OpenTelemetryTransportV3());
  }

  if (enableConsole) {
    transports.push(
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
    transports
  });
};
