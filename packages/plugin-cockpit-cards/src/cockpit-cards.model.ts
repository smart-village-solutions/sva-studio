import { z } from 'zod';

import {
  COCKPIT_CARD_GENERIC_TYPE,
  DEFAULT_COCKPIT_CARD_LANGUAGE_CODE,
} from './cockpit-cards.constants.js';
import type {
  CockpitCardFormValues,
  CockpitCardPayload,
  GenericItemCockpitCardInput,
  GenericItemCockpitCardRecord,
} from './cockpit-cards.types.js';

const htmlTagPattern = /<\/?[a-z][^>]*>/i;
const languageCodePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const imageSchema = z.object({
  sourceUrl: z.object({
    url: z.string().url().startsWith('https://'),
    description: z.string().optional(),
  }).passthrough(),
  contentType: z.literal('image'),
  captionText: z.string().optional(),
  copyright: z.string().optional(),
}).passthrough();

export const cockpitCardFormSchema = z.object({
  heading: z.string().trim().min(1),
  text: z
    .string()
    .trim()
    .refine((value) => !htmlTagPattern.test(value), 'html_not_allowed'),
  languageCode: z.string().trim().refine(
    (value) => value.length === 0 || languageCodePattern.test(value),
    'invalid_language_code'
  ),
  sortWeight: z.number().int().finite(),
  category: z.string().trim().min(1),
  images: z.array(imageSchema),
  link: z.string().trim().url().startsWith('https://').optional().or(z.literal('')),
  visible: z.boolean(),
  publicationDate: z.string().trim().min(1).optional().or(z.literal('')),
});

const normalizeLanguageCode = (value: string): string => {
  const [language, ...subtags] = value.trim().split('-');
  return [
    language?.toLowerCase(),
    ...subtags.map((subtag) => (subtag.length === 2 ? subtag.toUpperCase() : subtag)),
  ]
    .filter((part): part is string => Boolean(part))
    .join('-');
};
const toPayloadRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

export const readCockpitCardPayload = (value: unknown): CockpitCardPayload => {
  const payload = toPayloadRecord(value);
  const languageCode =
    typeof payload.languageCode === 'string' &&
    languageCodePattern.test(payload.languageCode.trim())
      ? normalizeLanguageCode(payload.languageCode)
      : DEFAULT_COCKPIT_CARD_LANGUAGE_CODE;
  const sortWeight =
    typeof payload.sortWeight === 'number' && Number.isInteger(payload.sortWeight)
      ? payload.sortWeight
      : 0;
  return { languageCode, sortWeight };
};

export const mapGenericItemToCockpitCardFormValues = (
  item: GenericItemCockpitCardRecord
): CockpitCardFormValues => {
  const payload = readCockpitCardPayload(item.payload);
  return {
    heading: item.title,
    text: item.contentBlocks[0]?.body ?? '',
    languageCode: payload.languageCode,
    sortWeight: payload.sortWeight,
    category: item.categories[0]?.name ?? '',
    images: [...item.mediaContents],
    link: item.webUrls[0]?.url ?? '',
    visible: item.visible,
    ...(item.publicationDate ? { publicationDate: item.publicationDate } : {}),
  };
};

export const mapCockpitCardFormValuesToGenericItemInput = (
  values: CockpitCardFormValues,
  existingPayload?: unknown
): GenericItemCockpitCardInput => {
  const parsed = cockpitCardFormSchema.parse(values);
  return {
    title: parsed.heading,
    genericType: COCKPIT_CARD_GENERIC_TYPE,
    contentBlocks: parsed.text ? [{ body: parsed.text }] : [],
    payload: {
      ...toPayloadRecord(existingPayload),
      languageCode: normalizeLanguageCode(parsed.languageCode),
      sortWeight: parsed.sortWeight,
    },
    categoryName: parsed.category,
    categories: [{ name: parsed.category }],
    mediaContents: parsed.images,
    webUrls: parsed.link ? [{ url: parsed.link }] : [],
    visible: parsed.visible,
    ...(parsed.publicationDate ? { publicationDate: parsed.publicationDate } : {}),
  };
};

export const isCockpitCardGenericItem = (item: Pick<GenericItemCockpitCardRecord, 'genericType'>) =>
  item.genericType === COCKPIT_CARD_GENERIC_TYPE;

export const compareCockpitCardRecords = (
  left: GenericItemCockpitCardRecord,
  right: GenericItemCockpitCardRecord
): number => {
  const leftPayload = readCockpitCardPayload(left.payload);
  const rightPayload = readCockpitCardPayload(right.payload);
  return (
    leftPayload.languageCode.localeCompare(rightPayload.languageCode) ||
    leftPayload.sortWeight - rightPayload.sortWeight ||
    new Intl.Collator(leftPayload.languageCode, {
      usage: 'sort',
      sensitivity: 'base',
      numeric: true,
    }).compare(left.title, right.title) ||
    left.id.localeCompare(right.id)
  );
};
