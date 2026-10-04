import { usePluginTranslation } from '@sva/plugin-sdk';

export const createPoiDeviationFieldLabels = (
  pt: ReturnType<typeof usePluginTranslation>
): Readonly<Record<string, string>> => {
  return {
    name: pt('fields.name'),
    description: pt('fields.description'),
    mobileDescription: pt('fields.mobileDescription'),
    categories: pt('fields.categories'),
    category: pt('fields.categoryName'),
    addresses: pt('fields.street'),
    contact: pt('fields.contact'),
    openingHours: pt('fields.weekday'),
    operatingCompany: pt('fields.operatorName'),
    priceInformations: pt('fields.amount'),
    webUrls: pt('fields.url'),
    mediaContents: pt('fields.mediaContentType'),
    location: pt('fields.locationName'),
    certificates: pt('fields.certificateName'),
    accessibilityInformation: pt('fields.accessibilityDescription'),
    externalId: pt('fields.externalId'),
    keywords: pt('fields.keywords'),
    tags: pt('fields.tags'),
    payload: pt('fields.payload'),
    active: pt('fields.active'),
    visible: pt('fields.active'),
    createdAt: pt('fields.createdAt'),
    updatedAt: pt('fields.updatedAt'),
  };
};
