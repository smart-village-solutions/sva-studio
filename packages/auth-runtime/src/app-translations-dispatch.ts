import { z } from 'zod';
import type { TranslationProviderPin } from './app-translations-providers.js';
import { getRedisClient } from './redis.js';

// A retry of the same requestId must keep its provider. Store only dispatch metadata.
const dispatchPinSchema = z.object({
  interfaceId: z.string(),
  credentialRevision: z.string(),
  request: z.string(),
});
const dispatchPinTtlSeconds = 7 * 24 * 60 * 60;

export const loadTranslationDispatch = async (
  input: {
    instanceId: string;
    requestId: string;
    sourceDigest: string;
    profileId: string;
    targetLocale: string;
  },
  subject: string
) => {
  const redis = getRedisClient();
  const key = `app-translations:dispatch:${input.instanceId}:${input.requestId}`;
  const request = [input.sourceDigest, input.profileId, input.targetLocale, subject].join(':');
  const stored = await redis.get(key);
  const pin = stored ? dispatchPinSchema.parse(JSON.parse(stored)) : undefined;
  return {
    pin,
    request,
    async claim(provider: TranslationProviderPin) {
      const value = JSON.stringify({ ...provider, request });
      return (
        Boolean(await redis.set(key, value, 'EX', dispatchPinTtlSeconds, 'NX')) ||
        (await redis.get(key)) === value
      );
    },
  };
};
