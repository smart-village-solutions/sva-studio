import type { ContentJsonValue } from '@sva/core';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

const HTTPS_URL_ERROR = 'Es sind nur HTTPS-URLs erlaubt.';
const NEWS_TEASER_REQUIRED_ERROR = 'Der Teaser ist erforderlich.';
const NEWS_TEASER_LENGTH_ERROR = 'Der Teaser darf maximal 500 Zeichen enthalten.';
const NEWS_BODY_REQUIRED_ERROR = 'Der Inhalt ist erforderlich.';
const NEWS_BODY_LENGTH_ERROR = 'Der Inhalt darf maximal 50.000 Zeichen enthalten.';
const NEWS_CATEGORY_LENGTH_ERROR = 'Die Kategorie darf maximal 128 Zeichen enthalten.';

const httpsUrlSchema = z
  .string()
  .url('URL ist ungültig.')
  .refine((value) => value.startsWith('https://'), HTTPS_URL_ERROR);

const sanitizePlainText = (value: string): string =>
  sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();

const hasVisibleTextContent = (value: string): boolean => sanitizePlainText(value).length > 0;

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
  teaser: z.string().trim().min(1, NEWS_TEASER_REQUIRED_ERROR).max(500, NEWS_TEASER_LENGTH_ERROR),
  body: z
    .string()
    .trim()
    .min(1, NEWS_BODY_REQUIRED_ERROR)
    .max(50_000, NEWS_BODY_LENGTH_ERROR)
    .refine(hasVisibleTextContent, NEWS_BODY_REQUIRED_ERROR),
  imageUrl: httpsUrlSchema.optional(),
  externalUrl: httpsUrlSchema.optional(),
  category: z.string().trim().max(128, NEWS_CATEGORY_LENGTH_ERROR).optional(),
});

type RegisteredContentTypeDefinition = {
  readonly payloadSchema: z.ZodType<ContentJsonValue>;
  readonly sanitizePayload?: (payload: ContentJsonValue) => ContentJsonValue;
};

const sanitizeNewsPayload = (parsed: z.infer<typeof newsPayloadSchema>): ContentJsonValue => {
  const sanitizedBody = sanitizeHtml(parsed.body, NEWS_BODY_SANITIZER_OPTIONS).trim();

  return {
    ...parsed,
    teaser: sanitizePlainText(parsed.teaser),
    body: sanitizedBody,
  } satisfies ContentJsonValue;
};

const newsContentTypeDefinition: RegisteredContentTypeDefinition = {
  payloadSchema: newsPayloadSchema as z.ZodType<ContentJsonValue>,
  sanitizePayload: (payload) => sanitizeNewsPayload(payload as z.infer<typeof newsPayloadSchema>),
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
