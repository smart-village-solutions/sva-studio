export const GENERIC_CONTENT_TYPE = 'generic' as const;

export const iamContentStatuses = ['draft', 'in_review', 'approved', 'published', 'archived'] as const;

export type IamContentStatus = (typeof iamContentStatuses)[number];

export type ContentJsonPrimitive = string | number | boolean | null;
export type ContentJsonValue =
  | ContentJsonPrimitive
  | { readonly [key: string]: ContentJsonValue }
  | readonly ContentJsonValue[];

export type IamContentHistoryEntry = {
  readonly id: string;
  readonly contentId: string;
  readonly action: 'created' | 'updated' | 'status_changed';
  readonly actor: string;
  readonly changedFields: readonly string[];
  readonly fromStatus?: IamContentStatus;
  readonly toStatus?: IamContentStatus;
  readonly createdAt: string;
  readonly summary?: string;
};

export type IamContentListItem = {
  readonly id: string;
  readonly contentType: string;
  readonly title: string;
  readonly publishedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author: string;
  readonly payload: ContentJsonValue;
  readonly status: IamContentStatus;
};

export type IamContentDetail = IamContentListItem & {
  readonly history: readonly IamContentHistoryEntry[];
};

export type CreateIamContentInput = {
  readonly contentType: string;
  readonly title: string;
  readonly publishedAt?: string;
  readonly payload: ContentJsonValue;
  readonly status: IamContentStatus;
};

export type UpdateIamContentInput = Partial<CreateIamContentInput>;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const isIamContentStatus = (value: unknown): value is IamContentStatus =>
  typeof value === 'string' && (iamContentStatuses as readonly string[]).includes(value);

export const isContentJsonValue = (value: unknown): value is ContentJsonValue => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isContentJsonValue);
  }

  if (isPlainObject(value)) {
    return Object.values(value).every(isContentJsonValue);
  }

  return false;
};

export const validateCreateIamContentInput = (
  input: {
    readonly contentType?: string;
    readonly title?: string;
    readonly publishedAt?: string;
    readonly payload?: unknown;
    readonly status?: unknown;
  },
  registeredContentTypes: readonly string[]
): readonly string[] => {
  const errors: string[] = [];

  if (!input.contentType || !registeredContentTypes.includes(input.contentType)) {
    errors.push('contentType');
  }

  if (!input.title || input.title.trim().length === 0) {
    errors.push('title');
  }

  if (!isIamContentStatus(input.status)) {
    errors.push('status');
  }

  if (!isContentJsonValue(input.payload)) {
    errors.push('payload');
  }

  if (
    input.status === 'published' &&
    (!input.publishedAt || Number.isNaN(new Date(input.publishedAt).getTime()))
  ) {
    errors.push('publishedAt');
  }

  return errors;
};
