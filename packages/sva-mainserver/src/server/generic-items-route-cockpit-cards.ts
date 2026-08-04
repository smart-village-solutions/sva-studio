import type { SvaMainserverGenericItemInput } from '../types.js';
import { errorJson, isResponse } from './content-route-core.js';
import { parseGenericItemInput } from './generic-items-route-input.js';

const htmlPattern = /<\/?[a-z][^>]*>/i;
const languagePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const payloadRecord = (payload: unknown): Record<string, unknown> =>
  payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
export const mergeCockpitCardPayload = (existing: unknown, next: unknown) => ({
  ...payloadRecord(existing),
  ...payloadRecord(next),
});

export const validateCockpitCardItemOrResponse = (
  item: SvaMainserverGenericItemInput
): Response | null => {
  const text = item.contentBlocks?.[0]?.body?.trim() ?? '';
  if ((item.contentBlocks?.length ?? 0) > 1)
    return errorJson(400, 'invalid_request', 'Cockpit Cards unterstützen höchstens einen Textblock.');
  if (htmlPattern.test(text))
    return errorJson(400, 'invalid_request', 'HTML im Cockpit-Card-Text ist nicht erlaubt.');
  const payload = payloadRecord(item.payload);
  if (
    payload.languageCode !== undefined &&
    (typeof payload.languageCode !== 'string' ||
      (payload.languageCode.trim().length > 0 && !languagePattern.test(payload.languageCode.trim())))
  )
    return errorJson(400, 'invalid_request', 'Der Cockpit-Card-Sprachcode ist ungültig.');
  if (
    typeof payload.sortWeight !== 'number' ||
    !Number.isInteger(payload.sortWeight) ||
    !Number.isFinite(payload.sortWeight)
  )
    return errorJson(400, 'invalid_request', 'Das Cockpit-Card-Sortiergewicht ist ungültig.');
  if (item.categories?.length !== 1 || !item.categories[0]?.name?.trim())
    return errorJson(400, 'invalid_request', 'Genau eine Cockpit-Card-Kategorie ist erforderlich.');
  if (
    item.mediaContents?.some(
      (media) => media.contentType !== 'image' || !media.sourceUrl?.url.startsWith('https://')
    )
  )
    return errorJson(
      400,
      'invalid_request',
      'Cockpit Cards unterstützen ausschließlich gültige HTTPS-Bilder.'
    );
  if (
    (item.webUrls?.length ?? 0) > 1 ||
    item.webUrls?.some((link) => !link.url.startsWith('https://'))
  )
    return errorJson(
      400,
      'invalid_request',
      'Cockpit Cards unterstützen höchstens einen HTTPS-Link.'
    );
  if (
    (item.contacts?.length ?? 0) ||
    (item.addresses?.length ?? 0) ||
    (item.locations?.length ?? 0)
  )
    return errorJson(
      400,
      'invalid_request',
      'Cockpit Cards unterstützen keine Kontakte, Adressen oder Orte.'
    );
  return null;
};

export const validateCockpitCardWriteOrResponse = async (
  request: Request
): Promise<SvaMainserverGenericItemInput | Response> => {
  const item = await parseGenericItemInput(request);
  return isResponse(item) ? item : (validateCockpitCardItemOrResponse(item) ?? item);
};
