const readErrorRecord = (error: unknown): Readonly<Record<string, unknown>> | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  return error as Readonly<Record<string, unknown>>;
};

export const isTokenErrorLike = (error: unknown): boolean => {
  const typed = readErrorRecord(error);
  if (!typed) {
    return false;
  }

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

const parseStatusCode = (status: unknown): number => {
  if (typeof status === 'number') {
    return status;
  }
  if (typeof status === 'string') {
    return Number.parseInt(status, 10);
  }
  return Number.NaN;
};

export const isRetryableTokenExchangeError = (error: unknown): boolean => {
  const typed = readErrorRecord(error);
  if (!typed) {
    return false;
  }

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
