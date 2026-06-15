import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 'v1';

const computeSignature = (input: {
  readonly subscriptionId: string;
  readonly unsubscribeTokenHash: string;
  readonly secret: string;
}): string =>
  createHmac('sha256', input.secret)
    .update(`${TOKEN_VERSION}:${input.subscriptionId}:${input.unsubscribeTokenHash}`)
    .digest('base64url');

const parseToken = (
  token: string
): Readonly<{
  subscriptionId: string;
  signature: string;
}> | null => {
  const [version, subscriptionId, signature, ...rest] = token.split('.');
  if (version !== TOKEN_VERSION || !subscriptionId || !signature || rest.length > 0) {
    return null;
  }

  return {
    subscriptionId,
    signature,
  };
};

export const createPublicWasteUnsubscribeToken = (input: {
  readonly subscriptionId: string;
  readonly unsubscribeTokenHash: string;
  readonly secret: string;
}): string => `${TOKEN_VERSION}.${input.subscriptionId}.${computeSignature(input)}`;

export const readPublicWasteUnsubscribeTokenSubscriptionId = (token: string): string | null =>
  parseToken(token)?.subscriptionId ?? null;

export const verifyPublicWasteUnsubscribeToken = (input: {
  readonly token: string;
  readonly subscriptionId: string;
  readonly unsubscribeTokenHash: string;
  readonly secret: string;
}): boolean => {
  const parsed = parseToken(input.token);
  if (!parsed || parsed.subscriptionId !== input.subscriptionId) {
    return false;
  }

  const expected = Buffer.from(
    computeSignature({
      subscriptionId: input.subscriptionId,
      unsubscribeTokenHash: input.unsubscribeTokenHash,
      secret: input.secret,
    })
  );
  const received = Buffer.from(parsed.signature);

  return expected.length === received.length && timingSafeEqual(expected, received);
};
