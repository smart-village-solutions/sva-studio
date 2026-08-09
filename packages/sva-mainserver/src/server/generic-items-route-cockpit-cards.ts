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
  const contentBlocks = item.contentBlocks ?? [];
  const firstBlock = contentBlocks[0];
  const text = firstBlock?.body?.trim() ?? '';
  if (contentBlocks.length > 1)
    return errorJson(400, 'invalid_request', 'Kacheln unterstützen höchstens einen Textblock.');
  if (firstBlock && (!text || Object.keys(firstBlock).some((key) => key !== 'body')))
    return errorJson(
      400,
      'invalid_request',
      'Kachel-Textblöcke dürfen ausschließlich nicht leeren Text enthalten.'
    );
  if (htmlPattern.test(text))
    return errorJson(400, 'invalid_request', 'HTML im Kacheltext ist nicht erlaubt.');
  const payload = payloadRecord(item.payload);
  if (
    payload.languageCode !== undefined &&
    (typeof payload.languageCode !== 'string' ||
      (payload.languageCode.trim().length > 0 &&
        !languagePattern.test(payload.languageCode.trim())))
  )
    return errorJson(400, 'invalid_request', 'Der Kachel-Sprachcode ist ungültig.');
  if (
    typeof payload.sortWeight !== 'number' ||
    !Number.isInteger(payload.sortWeight) ||
    !Number.isFinite(payload.sortWeight)
  )
    return errorJson(400, 'invalid_request', 'Das Kachel-Sortiergewicht ist ungültig.');
  if (payload.openInNewTab !== undefined && typeof payload.openInNewTab !== 'boolean')
    return errorJson(400, 'invalid_request', 'Die Kachel-Linkoption ist ungültig.');
  if (item.categories?.length !== 1 || !item.categories[0]?.name?.trim())
    return errorJson(400, 'invalid_request', 'Genau eine Kachel-Kategorie ist erforderlich.');
  if (
    item.mediaContents?.some(
      (media) => media.contentType !== 'image' || !media.sourceUrl?.url.startsWith('https://')
    )
  )
    return errorJson(
      400,
      'invalid_request',
      'Kacheln unterstützen ausschließlich gültige HTTPS-Bilder.'
    );
  if (
    (item.webUrls?.length ?? 0) > 1 ||
    item.webUrls?.some((link) => !link.url.startsWith('https://'))
  )
    return errorJson(400, 'invalid_request', 'Kacheln unterstützen höchstens einen HTTPS-Link.');
  if (
    (item.contacts?.length ?? 0) ||
    (item.addresses?.length ?? 0) ||
    (item.locations?.length ?? 0)
  )
    return errorJson(
      400,
      'invalid_request',
      'Kacheln unterstützen keine Kontakte, Adressen oder Orte.'
    );
  return null;
};

export const validateCockpitCardWriteOrResponse = async (
  request: Request
): Promise<SvaMainserverGenericItemInput | Response> => {
  const item = await parseGenericItemInput(request);
  if (isResponse(item)) return item;
  const validation = validateCockpitCardItemOrResponse(item);
  if (validation) return validation;
  const payload = payloadRecord(item.payload);
  const webUrls = item.webUrls ?? [];
  return {
    ...item,
    contentBlocks: item.contentBlocks ?? [],
    mediaContents: item.mediaContents ?? [],
    webUrls,
    payload: {
      ...payload,
      languageCode: typeof payload.languageCode === 'string' ? payload.languageCode : '',
      openInNewTab: webUrls.length > 0 && payload.openInNewTab === true,
    },
  };
};
