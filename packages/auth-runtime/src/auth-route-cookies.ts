import { serialize as serializeCookie } from 'cookie-es';
import { appendSetCookie, deleteCookieHeader } from './cookies.js';
import { encodeLoginStateCookie, type LoginStateCookiePayload } from './login-state-cookie.js';
import { DEV_AUTH_COOKIE_NAME } from './mock-auth.js';

const createAuthCookieOptions = () => {
  const isBuilderDevAuth = process.env.BUILDER_DEV_AUTH === 'true';

  return {
    httpOnly: true,
    secure: isBuilderDevAuth || process.env.NODE_ENV === 'production',
    sameSite: isBuilderDevAuth ? ('none' as const) : ('lax' as const),
    path: '/',
  };
};

const createTimedCookieOptions = (expiresAt: number | undefined) => {
  if (typeof expiresAt !== 'number') {
    return createAuthCookieOptions();
  }

  const maxAgeSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
  return {
    ...createAuthCookieOptions(),
    maxAge: maxAgeSeconds,
    expires: new Date(Date.now() + maxAgeSeconds * 1000),
  };
};

const createSessionCookie = (name: string, sessionId: string, expiresAt?: number) =>
  serializeCookie(name, sessionId, createTimedCookieOptions(expiresAt));

const createLoginStateCookie = (input: {
  name: string;
  secret: string;
  payload: LoginStateCookiePayload;
}) =>
  serializeCookie(
    input.name,
    encodeLoginStateCookie(input.payload, input.secret),
    createAuthCookieOptions()
  );

const createSilentSsoSuppressCookie = (name: string, suppressUntil: number) =>
  serializeCookie(name, String(suppressUntil), createTimedCookieOptions(suppressUntil));

export const createDevAuthCookie = () =>
  serializeCookie(DEV_AUTH_COOKIE_NAME, '1', createAuthCookieOptions());

export const getSetCookieValues = (headers: Headers): string[] => {
  const candidate = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof candidate.getSetCookie === 'function') {
    return candidate.getSetCookie();
  }

  const combined = headers.get('set-cookie');
  return combined ? [combined] : [];
};

export const describeTokenError = (error: unknown): Record<string, unknown> => {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const typed = error as {
    error?: unknown;
    code?: unknown;
    cause?: unknown;
    response?: { status?: unknown };
  };
  const cause =
    typed.cause && typeof typed.cause === 'object'
      ? (typed.cause as {
          error?: unknown;
          code?: unknown;
          response?: { status?: unknown };
        })
      : null;

  const readString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined;
  const readStatus = (value: unknown): number | undefined =>
    typeof value === 'number' ? value : undefined;

  const status = readStatus(typed.response?.status) ?? readStatus(cause?.response?.status);
  return {
    oauth_error: readString(typed.error) ?? readString(cause?.error),
    oauth_code: readString(typed.code) ?? readString(cause?.code),
    oauth_status: status,
    retry_class: status !== undefined && status >= 500 ? 'transient' : 'non_retryable',
  };
};

export const attachLoginStateCookie = (
  response: Response,
  input: { name: string; secret: string; payload: LoginStateCookiePayload }
) => {
  appendSetCookie(response, createLoginStateCookie(input));
  return 'response';
};

export const attachSessionCookie = (
  response: Response,
  name: string,
  sessionId: string,
  expiresAt?: number
) => {
  appendSetCookie(response, createSessionCookie(name, sessionId, expiresAt));
  return 'response';
};

export const attachSilentSsoSuppressCookie = (response: Response, name: string, suppressUntil: number) => {
  appendSetCookie(response, createSilentSsoSuppressCookie(name, suppressUntil));
  return 'response';
};

export const attachDeletedCookie = (response: Response, name: string) => {
  appendSetCookie(response, deleteCookieHeader(name));
  return 'response';
};

export const createSilentSsoResponse = (status: 'success' | 'failure') =>
  new Response(
    `<!doctype html><html><body><script>
window.parent.postMessage({ type: 'sva-auth:silent-sso', status: '${status}' }, window.location.origin);
</script></body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
