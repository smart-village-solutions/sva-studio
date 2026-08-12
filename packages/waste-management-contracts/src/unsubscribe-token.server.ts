import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 'v1';

type WasteManagementUnsubscribeTokenInput = {
  readonly subscriptionId: string;
  readonly unsubscribeTokenHash: string;
  readonly secret: string;
};

const computeSignature = (input: WasteManagementUnsubscribeTokenInput): string =>
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

export const createWasteManagementUnsubscribeToken = (
  input: WasteManagementUnsubscribeTokenInput
): string => `${TOKEN_VERSION}.${input.subscriptionId}.${computeSignature(input)}`;

export const readWasteManagementUnsubscribeTokenSubscriptionId = (token: string): string | null =>
  parseToken(token)?.subscriptionId ?? null;

export const verifyWasteManagementUnsubscribeToken = (
  input: WasteManagementUnsubscribeTokenInput & {
    readonly token: string;
  }
): boolean => {
  const parsed = parseToken(input.token);
  if (!parsed || parsed.subscriptionId !== input.subscriptionId) {
    return false;
  }

  const expected = Buffer.from(computeSignature(input));
  const received = Buffer.from(parsed.signature);

  return expected.length === received.length && timingSafeEqual(expected, received);
};
