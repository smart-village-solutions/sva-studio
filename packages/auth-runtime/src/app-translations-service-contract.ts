import {
  appTranslationLanguage,
  isAppTranslationLocale,
  isValidInstanceId,
  type CatalogValue,
} from '@sva/core';
import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';
import { z } from 'zod';

const entrySchema = z
  .object({
    key: z
      .string()
      .regex(
        /^(title|author|keywords|settings\.onlySummaryLinkText|contentBlocks\.(0|[1-9][0-9]{0,5})\.(title|intro|body|mediaContents\.(0|[1-9][0-9]{0,5})\.captionText))$/
      ),
    text: z.string().max(92160).regex(/\S/u),
    format: z.enum(['plain', 'html']),
  })
  .strict();
const requestEnvelope = z
  .object({
    schemaVersion: z.literal(1),
    instanceId: z.string().refine(isValidInstanceId),
    requestId: z.uuid(),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    sourceLocale: z.literal('de'),
    targetLocale: z
      .string()
      .refine(
        (locale) => isAppTranslationLocale(locale) && appTranslationLanguage(locale) !== 'de'
      ),
  })
  .strict();
const newsRequestSchema = requestEnvelope
  .extend({ profileId: z.literal('news-v1'), entries: z.array(entrySchema).min(1).max(50) })
  .superRefine((value, ctx) => {
    if (
      new Set(value.entries.map((entry) => entry.key)).size !== value.entries.length ||
      value.entries.filter((entry) => entry.key === 'title').length !== 1 ||
      value.entries.some(
        (entry) =>
          !entry.key.endsWith('.intro') &&
          entry.format !== (entry.key.endsWith('.body') ? 'html' : 'plain')
      ) ||
      value.entries.reduce((size, entry) => size + new TextEncoder().encode(entry.text).length, 0) >
        90000
    )
      ctx.addIssue({ code: 'custom', message: 'invalid_news_profile' });
    for (const entry of value.entries) {
      if (
        (entry.format === 'plain' && /[<>]/.test(entry.text)) ||
        (entry.format === 'html' && sanitizeRichTextHtml(entry.text) !== entry.text)
      )
        ctx.addIssue({ code: 'custom', message: 'invalid_news_text' });
    }
  });
const settingsRequestSchema = requestEnvelope.extend({
  profileId: z.literal('global-settings-v1'),
  entries: z.tuple([
    z
      .object({
        key: z.literal('label'),
        format: z.literal('plain'),
        text: z
          .string()
          .regex(/\S/u)
          .refine(
            (text) => !/[<>]|\{\{|%\{/.test(text) && new TextEncoder().encode(text).length <= 2048
          ),
      })
      .strict(),
  ]),
});
const staticHtmlRequestSchema = requestEnvelope.extend({
  profileId: z.literal('static-html-v1'),
  entries: z.tuple([
    z
      .object({
        key: z.literal('content'),
        format: z.literal('html'),
        text: z
          .string()
          .max(90000)
          .regex(/\S/u)
          .refine(
            (text) =>
              new TextEncoder().encode(text).length <= 90000 &&
              /^(?:<p>[^<>]+<\/p>)+$/u.test(text) &&
              sanitizeRichTextHtml(text) === text
          ),
      })
      .strict(),
  ]),
});
export const translationServiceRequestSchema = z.union([
  newsRequestSchema,
  settingsRequestSchema,
  staticHtmlRequestSchema,
]);

export type TranslationServiceInput = z.infer<typeof translationServiceRequestSchema>;

const validTranslatedEntry = (
  value: CatalogValue,
  entry: TranslationServiceInput['entries'][number] | undefined
): boolean => {
  if (!entry || typeof value !== 'string') return false;
  if (new TextEncoder().encode(value).length > 100000 || value.trim().length === 0) return false;
  if (entry.format === 'plain') return !/[<>]/.test(value);
  return (
    sanitizeRichTextHtml(value) === value &&
    JSON.stringify(value.match(/<[^>]*>/g) ?? []) ===
      JSON.stringify(entry.text.match(/<[^>]*>/g) ?? [])
  );
};
export const assertTranslatedEntries = (
  input: TranslationServiceInput,
  translated: CatalogValue[]
): void => {
  if (
    translated.length !== input.entries.length ||
    translated.some((value, index) => !validTranslatedEntry(value, input.entries[index]))
  )
    throw new Error('deepl_invalid_response');
};
