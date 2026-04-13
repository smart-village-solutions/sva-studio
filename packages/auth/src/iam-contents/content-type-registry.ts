import type { ContentJsonValue } from '@sva/core';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

const HTTPS_URL_ERROR = 'Es sind nur HTTPS-URLs erlaubt.';

const httpsUrlSchema = z
  .string()
  .url('URL ist ungültig.')
  .refine((value) => value.startsWith('https://'), HTTPS_URL_ERROR);

const sanitizePlainText = (value: string): string =>
  sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();

const NEWS_BODY_SANITIZER_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'br', 'img'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
  },
  allowedSchemes: ['https'],
  allowedSchemesByTag: {
    img: ['https'],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

const newsPayloadSchema = z.object({
  teaser: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(50_000),
  imageUrl: httpsUrlSchema.optional(),
  externalUrl: httpsUrlSchema.optional(),
  category: z.string().trim().max(128).optional(),
});

type RegisteredContentTypeDefinition = {
  readonly payloadSchema: z.ZodType<ContentJsonValue>;
  readonly sanitizePayload?: (payload: ContentJsonValue) => ContentJsonValue;
};

const sanitizeNewsPayload = (payload: ContentJsonValue): ContentJsonValue => {
  const parsed = newsPayloadSchema.parse(payload);
  const sanitizedBody = sanitizeHtml(parsed.body, NEWS_BODY_SANITIZER_OPTIONS).trim();

  return {
    ...parsed,
    teaser: sanitizePlainText(parsed.teaser),
    body: sanitizedBody.length > 0 ? sanitizedBody : '<p></p>',
  } satisfies ContentJsonValue;
};

const registry = new Map<string, RegisteredContentTypeDefinition>([
  [
    'news',
    {
      payloadSchema: newsPayloadSchema as z.ZodType<ContentJsonValue>,
      sanitizePayload: sanitizeNewsPayload,
    },
  ],
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
