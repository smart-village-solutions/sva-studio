export const DEV_AUTH_LOGIN_ENDPOINT = '/auth/dev-login';
export const DEV_AUTH_LOGOUT_ENDPOINT = '/auth/dev-logout';
export const DEV_AUTH_COOKIE_NAME = 'sva_dev_auth';

const readCookieValue = (cookieHeader: string, name: string): string | null => {
  const cookieName = `${encodeURIComponent(name)}=`;

  for (const rawPart of cookieHeader.split(';')) {
    const part = rawPart.trim();
    if (!part.startsWith(cookieName)) {
      continue;
    }

    return decodeURIComponent(part.slice(cookieName.length));
  }

  return null;
};

export const isDevAuthAvailable = (): boolean => {
  return (
    import.meta.env.VITE_SVA_DEV_AUTH === true ||
    import.meta.env.VITE_SVA_DEV_AUTH === 'true' ||
    import.meta.env.VITE_MOCK_AUTH === true ||
    import.meta.env.VITE_MOCK_AUTH === 'true'
  );
};

export const hasActiveDevAuthSessionCookie = (cookieHeader: string | null | undefined): boolean =>
  typeof cookieHeader === 'string' && readCookieValue(cookieHeader, DEV_AUTH_COOKIE_NAME) === '1';

export const hasActiveDevAuthSession = (): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }

  return hasActiveDevAuthSessionCookie(document.cookie);
};
