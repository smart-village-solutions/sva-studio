import { parse as parseCookie, serialize as serializeCookie } from 'cookie-es';

export const readCookieFromRequest = (request: Request, name: string): string | undefined => {
  const cookies = parseCookie(request.headers.get('cookie') ?? '');
  return cookies[name];
};

export const appendSetCookie = (response: Response, cookie: string) => {
  response.headers.append('set-cookie', cookie);
};

export const deleteCookieHeader = (name: string, options: Parameters<typeof serializeCookie>[2] = {}) =>
  serializeCookie(name, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    ...options,
  });
