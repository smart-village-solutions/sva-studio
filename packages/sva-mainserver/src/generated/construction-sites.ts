import { voucherPoiWriteFields } from './vouchers.js';
import type { WriteShape } from '../server/vouchers-snapshot.js';

// The same existing GenericItem nested field types also carry construction sites.
const {
  id: _id,
  visible: _visible,
  teaser: _teaser,
  discountType: _discount,
  quota: _quota,
  ...fields
} = voucherPoiWriteFields.vouchers;
export const constructionSiteWriteFields = fields;
const selection = (shape: WriteShape): string =>
  Object.entries(shape)
    .map(([key, value]) => (typeof value === 'object' ? `${key} { ${selection(value)} }` : key))
    .join(' ');
export const constructionSiteFields = `${selection(fields)} id visible updatedAt
  dataProvider { id name } ancestry memberId pointOfInterest { id }
  genericItems { id } genericItemMessages { id } pushNotifications { __typename }
  quota { maxQuantity } discountType { originalPrice }`;
export const constructionSiteDetailDocument = `query SvaMainserverConstructionSiteDetail($id: ID!) {
  genericItem(id: $id) { ${constructionSiteFields} }
}`;
export const constructionSiteListDocument = `query SvaMainserverConstructionSiteList($limit: Int!, $skip: Int!) {
  genericItems(genericType: "ConstructionSite", limit: $limit, skip: $skip, order: id_ASC) {
    ${constructionSiteFields}
  }
}`;
export const constructionSiteOperationDocument = `query SvaMainserverConstructionSiteOperation($externalId: ID!) {
  genericItems(genericType: "ConstructionSite", externalId: $externalId, limit: 2) { id }
}`;
const variableTypes: Record<keyof typeof fields, string> = {
  author: 'String',
  keywords: 'String',
  title: 'String!',
  genericType: 'String!',
  externalId: 'String',
  publicationDate: 'String',
  publishedAt: 'String',
  payload: 'JSON',
  contacts: '[ContactInput!]',
  companies: '[OperatingCompanyInput!]',
  categories: '[CategoryInput!]',
  webUrls: '[WebUrlInput!]',
  addresses: '[AddressInput!]',
  contentBlocks: '[ContentBlockInput!]',
  openingHours: '[OpeningHourInput!]',
  priceInformations: '[PriceInput!]',
  mediaContents: '[MediaContentInput!]',
  locations: '[LocationInput!]',
  dates: '[DateInput!]',
  accessibilityInformations: '[AccessibilityInformationInput!]',
};
export const constructionSiteWriteDocument = `mutation SvaMainserverConstructionSiteWrite(
  $id: ID, $visible: Boolean!, ${Object.entries(variableTypes)
    .map(([key, type]) => `$${key}: ${type}`)
    .join(', ')}
) { createGenericItem(id: $id, visible: $visible, forceCreate: true,
  ${Object.keys(fields)
    .map((key) => `${key}: $${key}`)
    .join(', ')}) { id }
}`;
