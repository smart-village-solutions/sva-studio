import { createHmac } from 'node:crypto';

const TOKEN_VERSION = 'v1';

export const createWasteManagementUnsubscribeToken = (input: {
  readonly subscriptionId: string;
  readonly unsubscribeTokenHash: string;
  readonly secret: string;
}): string => {
  const signature = createHmac('sha256', input.secret)
    .update(`${TOKEN_VERSION}:${input.subscriptionId}:${input.unsubscribeTokenHash}`)
    .digest('base64url');
  return `${TOKEN_VERSION}.${input.subscriptionId}.${signature}`;
};
