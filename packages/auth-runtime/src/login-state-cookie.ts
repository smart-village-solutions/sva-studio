import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import type { LoginState } from '@sva/auth/server';

export type LoginStateCookiePayload = LoginState & {
  state: string;
  returnTo?: string;
};

const nonNegativeFiniteNumberSchema = z.number().refine(
  (value) => Number.isFinite(value) && value >= 0,
  'expected non-negative finite number'
);

const baseLoginStateCookieSchema = z.object({
  state: z.string().trim().min(1),
  codeVerifier: z.string().trim().min(1),
  nonce: z.string().trim().min(1),
  createdAt: nonNegativeFiniteNumberSchema,
  returnTo: z.string().trim().min(1).optional(),
  silent: z.boolean().optional(),
});

const loginStateCookiePayloadSchema = z.discriminatedUnion('kind', [
  baseLoginStateCookieSchema.extend({
    kind: z.literal('platform'),
  }),
  baseLoginStateCookieSchema.extend({
    kind: z.literal('instance'),
    instanceId: z.string().trim().min(1),
  }),
]);

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
    const parsed = JSON.parse(json);
    const result = loginStateCookiePayloadSchema.safeParse(parsed);
    return result.success ? (result.data as LoginStateCookiePayload) : null;
  } catch {
    return null;
  }
};
