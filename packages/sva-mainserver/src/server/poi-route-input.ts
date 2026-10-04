import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';

import type { SvaMainserverPoiInput } from '../types.js';
import {
  errorJson,
  isResponse,
  parseJsonObjectBody,
  readBoolean,
  readString,
} from './content-route-core.js';
import {
  parseAccessibilityInformation,
  parseAddressList,
  parseCertificates,
  parseCategories,
  parseContact,
  parseLocation,
  parseMediaContents,
  parseOpeningHours,
  parseOperatingCompany,
  parsePrices,
  parseTags,
  parseWebUrls,
} from './content-route-parsers.js';
import { createSvaMainserverPoi, getSvaMainserverPoiDetail } from './service.js';
import {
  authorizeMainserverCreateForPrincipal,
  finalizeMainserverMutation,
  recordCreatedMainserverDataProvider,
  type MainserverMutationActor,
} from './mutation-principal.js';
import { POI_CONTENT_TYPE } from './poi-route-access.js';

const poiTextFields = (body: Record<string, unknown>) => {
  const description = readString(body.description);
  const sanitizedDescription = description ? sanitizeRichTextHtml(description) : undefined;
  return {
    ...(sanitizedDescription ? { description: sanitizedDescription } : {}),
    ...(typeof body.mobileDescription === 'string'
      ? { mobileDescription: body.mobileDescription.trim() }
      : {}),
    ...(typeof body.externalId === 'string' ? { externalId: body.externalId.trim() } : {}),
    ...(typeof body.keywords === 'string' ? { keywords: body.keywords.trim() } : {}),
    ...(readBoolean(body.active) !== undefined ? { active: readBoolean(body.active) } : {}),
    ...(readString(body.categoryName) ? { categoryName: readString(body.categoryName) } : {}),
    ...(body.payload !== undefined ? { payload: body.payload } : {}),
  };
};

const buildPoiInput = (input: {
  body: Record<string, unknown>;
  name: string;
  categories: SvaMainserverPoiInput['categories'] | undefined;
  addresses: SvaMainserverPoiInput['addresses'] | undefined;
  contact: ReturnType<typeof parseContact> extends Response | infer T | undefined
    ? T | undefined
    : never;
  priceInformations: SvaMainserverPoiInput['priceInformations'] | undefined;
  openingHours: SvaMainserverPoiInput['openingHours'] | undefined;
  operatingCompany: SvaMainserverPoiInput['operatingCompany'] | undefined;
  webUrls: SvaMainserverPoiInput['webUrls'] | undefined;
  mediaContents: SvaMainserverPoiInput['mediaContents'] | undefined;
  location: SvaMainserverPoiInput['location'] | undefined;
  certificates: SvaMainserverPoiInput['certificates'] | undefined;
  accessibilityInformation: SvaMainserverPoiInput['accessibilityInformation'] | undefined;
  tags: readonly string[] | undefined;
}): SvaMainserverPoiInput => {
  return {
    name: input.name,
    ...poiTextFields(input.body),
    ...(input.categories ? { categories: input.categories } : {}),
    ...(input.addresses ? { addresses: input.addresses } : {}),
    ...(input.contact ? { contact: input.contact } : {}),
    ...(input.priceInformations ? { priceInformations: input.priceInformations } : {}),
    ...(input.openingHours ? { openingHours: input.openingHours } : {}),
    ...(input.operatingCompany ? { operatingCompany: input.operatingCompany } : {}),
    ...(input.webUrls ? { webUrls: input.webUrls } : {}),
    ...(input.mediaContents ? { mediaContents: input.mediaContents } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.certificates ? { certificates: input.certificates } : {}),
    ...(input.accessibilityInformation
      ? { accessibilityInformation: input.accessibilityInformation }
      : {}),
    ...(input.tags ? { tags: input.tags } : {}),
  };
};

export const parsePoiInput = async (
  request: Request
): Promise<SvaMainserverPoiInput | Response> => {
  const body = await parseJsonObjectBody(request, 'POI-Daten müssen als Objekt gesendet werden.');
  if (isResponse(body)) {
    return body;
  }

  const name = readString(body.name);
  if (!name) {
    return errorJson(400, 'invalid_request', 'Der POI-Name ist erforderlich.');
  }
  const categories = parseCategories(body.categories);
  const addresses = parseAddressList(body.addresses);
  const contact = parseContact(body.contact);
  const priceInformations = parsePrices(body.priceInformations);
  const openingHours = parseOpeningHours(body.openingHours);
  const operatingCompany = parseOperatingCompany(body.operatingCompany);
  const webUrls = parseWebUrls(body.webUrls);
  const mediaContents = parseMediaContents(body.mediaContents);
  const location = parseLocation(body.location);
  const certificates = parseCertificates(body.certificates);
  const accessibilityInformation = parseAccessibilityInformation(body.accessibilityInformation);
  const tags = parseTags(body.tags);
  if (categories instanceof Response) {
    return categories;
  }
  if (addresses instanceof Response) {
    return addresses;
  }
  if (contact instanceof Response) {
    return contact;
  }
  if (priceInformations instanceof Response) {
    return priceInformations;
  }
  if (openingHours instanceof Response) {
    return openingHours;
  }
  if (operatingCompany instanceof Response) {
    return operatingCompany;
  }
  if (webUrls instanceof Response) {
    return webUrls;
  }
  if (mediaContents instanceof Response) {
    return mediaContents;
  }
  if (location instanceof Response) {
    return location;
  }
  if (certificates instanceof Response) {
    return certificates;
  }
  if (accessibilityInformation instanceof Response) {
    return accessibilityInformation;
  }
  if (tags instanceof Response) {
    return tags;
  }
  return buildPoiInput({
    body,
    name,
    categories,
    addresses,
    contact,
    priceInformations,
    openingHours,
    operatingCompany,
    webUrls,
    mediaContents,
    location,
    certificates,
    accessibilityInformation,
    tags,
  });
};

export const createPoiContent = async (request: Request, actor: MainserverMutationActor) => {
  const parsed = await parsePoiInput(request);
  if (isResponse(parsed)) {
    return parsed;
  }

  const principalAuthorization = await authorizeMainserverCreateForPrincipal({
    actor,
    action: 'poi.create',
    contentType: POI_CONTENT_TYPE,
  });
  if (isResponse(principalAuthorization)) return principalAuthorization;
  const data = await createSvaMainserverPoi({ ...actor, poi: parsed });
  const bindingResult = await recordCreatedMainserverDataProvider({
    actor,
    created: data,
    reread: async () => (await getSvaMainserverPoiDetail({ ...actor, poiId: data.id })).data,
    contentType: POI_CONTENT_TYPE,
  });
  await finalizeMainserverMutation({
    actor,
    providerOutcome: 'succeeded',
    reconciliationStatus:
      bindingResult.outcome === 'conflict' || bindingResult.outcome === 'reconciliation_required'
        ? 'reconciliation_required'
        : 'complete',
    completedSteps: ['provider_write', 'binding_observation'],
    contentId: data.id,
    observedDataProviderId: data.dataProvider?.id ?? bindingResult.observedDataProviderId,
  });
  return {
    data,
    ...(bindingResult.outcome === 'conflict' || bindingResult.outcome === 'reconciliation_required'
      ? { meta: { reconciliationStatus: 'reconciliation_required' as const } }
      : {}),
  };
};
