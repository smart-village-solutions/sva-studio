import type { SvaMainserverGenericItemInput } from '../types.js';
import { errorJson, isResponse } from './content-route-core.js';
import { parseGenericItemInput } from './generic-items-route-input.js';

const faqAnswerHtmlPattern = /<\/?[a-z][^>]*>/i;
const faqLanguageCodePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

const FAQ_UNSUPPORTED_SECTION_KEYS = [
  'categories',
  'contacts',
  'webUrls',
  'addresses',
  'openingHours',
  'priceInformations',
  'mediaContents',
  'locations',
  'dates',
  'accessibilityInformations',
] as const satisfies readonly (keyof SvaMainserverGenericItemInput)[];

const hasUnsupportedFaqSections = (genericItem: SvaMainserverGenericItemInput): boolean =>
  FAQ_UNSUPPORTED_SECTION_KEYS.some((key) => (genericItem[key]?.length ?? 0) > 0);

const hasUnsupportedFaqScalarFields = (genericItem: SvaMainserverGenericItemInput): boolean =>
  typeof genericItem.teaser === 'string' ||
  typeof genericItem.author === 'string' ||
  typeof genericItem.keywords === 'string' ||
  typeof genericItem.externalId === 'string' ||
  typeof genericItem.categoryName === 'string' ||
  typeof genericItem.publishedAt === 'string';

const readFaqPayloadRecord = (payload: unknown): Record<string, unknown> =>
  payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};

const validateFaqAnswer = (genericItem: SvaMainserverGenericItemInput): Response | null => {
  const contentBlocks = genericItem.contentBlocks ?? [];
  const answerBody = contentBlocks[0]?.body?.trim() ?? '';
  if (contentBlocks.length !== 1 || answerBody.length === 0) {
    return errorJson(400, 'invalid_request', 'Die FAQ-Antwort ist erforderlich.');
  }
  if (faqAnswerHtmlPattern.test(answerBody)) {
    return errorJson(400, 'invalid_request', 'HTML in der FAQ-Antwort ist nicht erlaubt.');
  }
  return null;
};

const validateFaqPayload = (genericItem: SvaMainserverGenericItemInput): Response | null => {
  const payloadRecord = readFaqPayloadRecord(genericItem.payload);
  const languageCode = payloadRecord.languageCode;
  if (typeof languageCode !== 'string' || !faqLanguageCodePattern.test(languageCode.trim())) {
    return errorJson(400, 'invalid_request', 'Der FAQ-Sprachcode ist ungültig.');
  }
  const sortWeight = payloadRecord.sortWeight;
  if (typeof sortWeight !== 'number' || !Number.isInteger(sortWeight) || !Number.isFinite(sortWeight)) {
    return errorJson(400, 'invalid_request', 'Das FAQ-Sortiergewicht ist ungültig.');
  }
  return null;
};

const validateFaqConstraints = (genericItem: SvaMainserverGenericItemInput): Response | null =>
  hasUnsupportedFaqSections(genericItem) || hasUnsupportedFaqScalarFields(genericItem)
    ? errorJson(400, 'invalid_request', 'FAQ unterstützt nur Frage, Antwort und kontrollierten Payload.')
    : null;

export const validateFaqItemOrResponse = (genericItem: SvaMainserverGenericItemInput): Response | null =>
  validateFaqAnswer(genericItem) ??
  validateFaqPayload(genericItem) ??
  validateFaqConstraints(genericItem);

export const validateFaqWriteOrResponse = async (request: Request): Promise<SvaMainserverGenericItemInput | Response> => {
  const genericItem = await parseGenericItemInput(request);
  return isResponse(genericItem) ? genericItem : validateFaqItemOrResponse(genericItem) ?? genericItem;
};
