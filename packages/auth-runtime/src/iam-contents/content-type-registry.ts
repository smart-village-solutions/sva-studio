import type { ContentJsonValue } from '@sva/core';
import { z } from 'zod';

const HTTPS_URL_ERROR = 'Es sind nur HTTPS-URLs erlaubt.';
const NEWS_CATEGORY_LENGTH_ERROR = 'Die Kategorie darf maximal 128 Zeichen enthalten.';

const httpsUrlSchema = z
  .string()
  .url('URL ist ungültig.')
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, HTTPS_URL_ERROR);

const newsPayloadSchema = z.object({
  imageUrl: httpsUrlSchema.optional(),
  externalUrl: httpsUrlSchema.optional(),
  category: z.string().trim().max(128, NEWS_CATEGORY_LENGTH_ERROR).optional(),
});

type RegisteredContentTypeDefinition = {
  readonly payloadSchema: z.ZodType<ContentJsonValue>;
  readonly sanitizePayload?: (payload: ContentJsonValue) => ContentJsonValue;
};

const newsContentTypeDefinition: RegisteredContentTypeDefinition = {
  payloadSchema: newsPayloadSchema as z.ZodType<ContentJsonValue>,
};

const registry = new Map<string, RegisteredContentTypeDefinition>([
  ['news.article', newsContentTypeDefinition],
  ['news', newsContentTypeDefinition],
]);

export const validateContentTypePayload = (
  contentType: string,
  payload: ContentJsonValue
): { ok: true; payload: ContentJsonValue } | { ok: false; message: string } => {
  const definition = registry.get(contentType);
  if (!definition) {
    return { ok: true, payload };
  }

  const parsed = definition.payloadSchema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { ok: false, message: firstIssue?.message ?? 'Payload ist ungültig.' };
  }

  return {
    ok: true,
    payload: definition.sanitizePayload ? definition.sanitizePayload(parsed.data) : parsed.data,
  };
};
