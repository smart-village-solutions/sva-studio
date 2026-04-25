export const isTokenErrorLike = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const typed = error as { name?: unknown; code?: unknown; error?: unknown };
  const name = typeof typed.name === 'string' ? typed.name.toLowerCase() : '';
  const code = typeof typed.code === 'string' ? typed.code.toLowerCase() : '';
  const oauthError = typeof typed.error === 'string' ? typed.error.toLowerCase() : '';
  return (
    name.includes('token') ||
    name.includes('oauth') ||
    code.includes('token') ||
    oauthError.length > 0
  );
};

const parseStatusCode = (status: unknown): number =>
  typeof status === 'number' ? status : typeof status === 'string' ? Number.parseInt(status, 10) : Number.NaN;

export const isRetryableTokenExchangeError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typed = error as { name?: unknown; code?: unknown; error?: unknown; status?: unknown };
  const name = typeof typed.name === 'string' ? typed.name.toLowerCase() : '';
  const code = typeof typed.code === 'string' ? typed.code.toLowerCase() : '';
  const oauthError = typeof typed.error === 'string' ? typed.error.toLowerCase() : '';
  const status = parseStatusCode(typed.status);

  return (
    oauthError === 'invalid_client' ||
    oauthError === 'unauthorized_client' ||
    code === 'invalid_client' ||
    code === 'unauthorized_client' ||
    name.includes('invalid_client') ||
    name.includes('unauthorized_client') ||
    status === 401
  );
};
