const sensitiveKey = /(?:authorization|cookie|password|secret|token|connection.?string|confirmation.?challenge|confirmation.?phrase)/i;
const bearer = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const jwt = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const credentialsInUrl = /(https?:\/\/)[^/@\s]+@/gi;

export const redactText = (value: string): string =>
  value.replace(bearer, 'Bearer [REDACTED]').replace(jwt, '[REDACTED]').replace(credentialsInUrl, '$1[REDACTED]@');

export const redact = (value: unknown): unknown => {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sensitiveKey.test(key) ? '[REDACTED]' : redact(item)])
    );
  }
  return value;
};
