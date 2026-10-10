const sensitiveKey =
  /(?:authorization|cookie|password|secret|token|api.?key|service.?role.?key|database.?url|connection.?string|confirmation.?challenge|confirmation.?phrase)/i;
const bearer = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const jwt = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const credentialsInUrl = /((?:https?|postgres(?:ql)?):\/\/)[^/@\s]+@/gi;

export const redactText = (value: string): string =>
  value
    .replace(bearer, 'Bearer [REDACTED]')
    .replace(jwt, '[REDACTED]')
    .replace(credentialsInUrl, '$1[REDACTED]@');

const isPublicOauthTokenUrl = (key: string, value: unknown): boolean => {
  if (key !== 'oauthTokenUrl' || typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
};

const isSensitiveKey = (key: string, value: unknown): boolean =>
  !isPublicOauthTokenUrl(key, value) &&
  key !== 'confirmationPhrase' &&
  !/(?:secret|apiKey)Configured$/iu.test(key) &&
  sensitiveKey.test(key);

export const redact = (value: unknown): unknown => {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSensitiveKey(key, item) ? '[REDACTED]' : redact(item),
      ])
    );
  }
  return value;
};
