import { voucherPoiWriteFields } from './vouchers.js';
import type { WriteShape } from '../server/vouchers-snapshot.js';
const {
  id: _id,
  visible: _visible,
  teaser: _teaser,
  discountType: _discount,
  quota: _quota,
  ...fields
} = voucherPoiWriteFields.vouchers;
export const jobWriteFields = fields;
const selection = (shape: WriteShape): string =>
  Object.entries(shape)
    .map(([key, field]) => (typeof field === 'object' ? `${key} { ${selection(field)} }` : key))
    .join(' ');
export const jobFields = `${selection(fields)} id visible updatedAt teaser description likeCount
  dataProvider { id name } ancestry memberId pointOfInterest { id }
  genericItems { id } genericItemMessages { id } pushNotifications { __typename }
  quota { maxQuantity } discountType { originalPrice }`;
export const jobDetailDocument = `query SvaMainserverJobDetail($id: ID!) {
  genericItem(id: $id) { ${jobFields} }
}`;
export const jobListDocument = `query SvaMainserverJobList($limit: Int!, $skip: Int!) {
  genericItems(genericType: "Job", limit: $limit, skip: $skip, order: id_ASC) { ${jobFields} }
}`;
// includeInactive requires the management integration role, proving the collision read is not visibility-filtered.
export const jobCollisionDocument = `query SvaMainserverJobCollision($externalId: ID!, $providerId: ID!) {
  categories(includeInactive: true) { id name active tagList }
  genericItems(externalId: $externalId, dataProviderId: $providerId, limit: 2) { id genericType dataProvider { id } }
}`;
export const jobCategoriesGuardDocument = `query SvaMainserverJobCategoriesGuard {
  categories(includeInactive: true) { id name active tagList }
}`;
// The role proof and absence read share one GraphQL authentication context.
export const jobDeletionVerificationDocument = `query SvaMainserverJobDeletionVerification($id: ID!) {
  categories(includeInactive: true) { id name active tagList }
  genericItem(id: $id) { id }
}`;
export const jobOperationDocument = `query SvaMainserverJobOperation($externalId: ID!, $limit: Int!, $skip: Int!) {
  genericItems(genericType: "Job", externalId: $externalId, limit: $limit, skip: $skip, order: id_ASC) { ${jobFields} }
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
export const jobWriteDocument = `mutation SvaMainserverJobWrite($id: ID, $visible: Boolean!, ${Object.entries(
  variableTypes
)
  .map(([key, type]) => `$${key}: ${type}`)
  .join(', ')}) {
  createGenericItem(id: $id, visible: $visible, forceCreate: true, ${Object.keys(fields)
    .map((key) => `${key}: $${key}`)
    .join(', ')}) { id }
}`;
