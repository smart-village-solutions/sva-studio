import { createHmac, timingSafeEqual } from 'node:crypto';

import type { LoginState } from '../types';

export type LoginStateCookiePayload = LoginState & {
  state: string;
};

export const encodeLoginStateCookie = (payload: LoginStateCookiePayload, secret: string) => {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json, 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
};

export const decodeLoginStateCookie = (value: string | undefined, secret: string) => {
  if (!value) {
    return null;
  }

  const [data, signature] = value.split('.');
  if (!data || !signature) {
    return null;
  }

  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const json = Buffer.from(data, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as LoginStateCookiePayload;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};
