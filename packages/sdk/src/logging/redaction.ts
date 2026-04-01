import { maskEmailAddresses } from '@sva/core';

const SENSITIVE_LOG_KEYS = new Set([
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
  'db_keycloak_subject',
]);

const jwtLikeRegex = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/g;
const querySecretRegexSource =
  String.raw`([?&](?:access_token|refresh_token|id_token|id_token_hint|token|code|client_secret|api_key|authorization)=)([^&#\s]+)`;
const inlineQuerySecretRegexSource =
  String.raw`((?:^|[\s,(])(?:access_token|refresh_token|id_token|id_token_hint|token|code|client_secret|api_key|authorization)[\w.-]{0,20}[=:]\s*)([^\s,)]+)`;
const inlineSensitiveFieldRegexSource =
  String.raw`((?:^|[\s,(])(?:password|secret|session|cookie|csrf)[\w.-]{0,20}[=:]\s*)([^\s,)]+)`;
const urlSecretPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(authorization:\s*)(bearer\s+)?[^\s,]+/gi, '$1[REDACTED]'],
  [/\b(bearer\s+)(?!\[REDACTED(?:_JWT)?\])[^\s,]+/gi, '$1[REDACTED]'],
  [new RegExp(querySecretRegexSource, 'gi'), '$1[REDACTED]'],
  [new RegExp(inlineQuerySecretRegexSource, 'gi'), '$1[REDACTED]'],
  [new RegExp(inlineSensitiveFieldRegexSource, 'gi'), '$1[REDACTED]'],
];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const stringifyNonPlainValue = (value: object): string => {
  const stringifier = value.toString;
  if (typeof stringifier === 'function' && stringifier !== Object.prototype.toString) {
    try {
      const customString = stringifier.call(value);
      return typeof customString === 'string'
        ? redactLogString(customString)
        : Object.prototype.toString.call(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  return Object.prototype.toString.call(value);
};

const serializeError = (value: Error): Record<string, unknown> => {
  const serialized: Record<string, unknown> = {
    name: value.name,
    message: redactLogString(value.message),
  };

  if (typeof value.stack === 'string') {
    serialized.stack = redactLogString(value.stack);
  }

  for (const [key, entry] of Object.entries(value)) {
    serialized[key] = serializeAndRedactLogValue(entry);
  }

  return serialized;
};

export const redactLogString = (value: string): string => {
  let next = maskEmailAddresses(value);
  next = next.replaceAll(jwtLikeRegex, '[REDACTED_JWT]');
  for (const [pattern, replacement] of urlSecretPatterns) {
    next = next.replaceAll(pattern, replacement);
  }
  return next;
};

export const serializeAndRedactLogValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === 'string') {
    return redactLogString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeAndRedactLogValue(item));
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (isPlainObject(value)) {
    return redactLogMeta(value);
  }

  if (typeof value === 'object') {
    return stringifyNonPlainValue(value);
  }

  return String(value);
};

export const redactLogMeta = (value: Record<string, unknown>): Record<string, unknown> => {
  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    if (SENSITIVE_LOG_KEYS.has(key.toLowerCase())) {
      acc[key] = '[REDACTED]';
      return acc;
    }

    acc[key] = serializeAndRedactLogValue(entry);
    return acc;
  }, {});
};
