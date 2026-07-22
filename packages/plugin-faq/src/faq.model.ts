import { z } from 'zod';

import { DEFAULT_FAQ_LANGUAGE_CODE, FAQ_GENERIC_TYPE } from './faq.constants.js';
import type { FaqFormValues, FaqPayload, GenericItemFaqInput, GenericItemFaqRecord } from './faq.types.js';

const htmlTagPattern = /<\/?[a-z][^>]*>/i;
const languageCodePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export const faqFormSchema = z.object({
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1).refine((value) => !htmlTagPattern.test(value), 'html_not_allowed'),
  languageCode: z.string().trim().regex(languageCodePattern, 'invalid_language_code'),
  sortWeight: z.number().int().finite(),
  visible: z.boolean(),
  publicationDate: z.string().trim().min(1).optional(),
});

const normalizeLanguageCode = (value: string): string => {
  const [language, ...subtags] = value.trim().split('-');
  return [language?.toLowerCase(), ...subtags.map((subtag) => (subtag.length === 2 ? subtag.toUpperCase() : subtag))]
    .filter((part): part is string => Boolean(part))
    .join('-');
};

const toPayloadRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};

export const readFaqPayload = (value: unknown): FaqPayload => {
  const payload = toPayloadRecord(value);
  const languageCode = typeof payload.languageCode === 'string' && languageCodePattern.test(payload.languageCode.trim())
    ? normalizeLanguageCode(payload.languageCode)
    : DEFAULT_FAQ_LANGUAGE_CODE;
  const sortWeight = typeof payload.sortWeight === 'number' && Number.isFinite(payload.sortWeight) && Number.isInteger(payload.sortWeight)
    ? payload.sortWeight
    : 0;
  return { languageCode, sortWeight };
};

export const mapGenericItemToFaqFormValues = (item: GenericItemFaqRecord): FaqFormValues => {
  const payload = readFaqPayload(item.payload);
  return {
    question: item.title,
    answer: item.contentBlocks[0]?.body ?? '',
    languageCode: payload.languageCode,
    sortWeight: payload.sortWeight,
    visible: item.visible,
    ...(item.publicationDate ? { publicationDate: item.publicationDate } : {}),
  };
};

export const mapFaqFormValuesToGenericItemInput = (
  values: FaqFormValues,
  existingPayload?: unknown
): GenericItemFaqInput => {
  const parsed = faqFormSchema.parse(values);
  const payload = {
    ...toPayloadRecord(existingPayload),
    languageCode: normalizeLanguageCode(parsed.languageCode),
    sortWeight: parsed.sortWeight,
  };
  return {
    title: parsed.question,
    genericType: FAQ_GENERIC_TYPE,
    contentBlocks: [{ body: parsed.answer }],
    payload,
    visible: parsed.visible,
    ...(parsed.publicationDate ? { publicationDate: parsed.publicationDate } : {}),
  };
};

export const isFaqGenericItem = (item: Pick<GenericItemFaqRecord, 'genericType'>): boolean => item.genericType === FAQ_GENERIC_TYPE;

export const compareFaqRecords = (left: GenericItemFaqRecord, right: GenericItemFaqRecord): number => {
  const leftPayload = readFaqPayload(left.payload);
  const rightPayload = readFaqPayload(right.payload);
  return (
    leftPayload.languageCode.localeCompare(rightPayload.languageCode) ||
    leftPayload.sortWeight - rightPayload.sortWeight ||
    new Intl.Collator(leftPayload.languageCode, { usage: 'sort', sensitivity: 'base', numeric: true }).compare(left.title, right.title) ||
    left.id.localeCompare(right.id)
  );
};
