export const GENERIC_CONTENT_TYPE = 'generic' as const;
export const IAM_PSEUDONYMIZED_CONTENT_AUTHOR_TOKEN = '__iam_author_pseudonymized__' as const;
export const IAM_DELETED_CONTENT_AUTHOR_TOKEN = '__iam_author_deleted__' as const;

export const iamContentStatuses = [
  'draft',
  'in_review',
  'approved',
  'published',
  'archived',
] as const;
export const iamContentListSortFields = ['title', 'createdAt', 'updatedAt', 'publishedAt'] as const;
export const iamContentListSortDirections = ['asc', 'desc'] as const;
export const iamContentValidationStates = ['valid', 'invalid', 'pending'] as const;
export type IamContentStatus = (typeof iamContentStatuses)[number];
export type IamContentListSortField = (typeof iamContentListSortFields)[number];
export type IamContentListSortDirection = (typeof iamContentListSortDirections)[number];
export type IamContentValidationState = (typeof iamContentValidationStates)[number];
