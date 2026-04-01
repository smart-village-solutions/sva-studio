export const GENERIC_CONTENT_TYPE = 'generic' as const;

export const iamContentStatuses = ['draft', 'in_review', 'approved', 'published', 'archived'] as const;
export const iamContentAccessStates = ['editable', 'read_only', 'blocked', 'server_denied'] as const;
export const iamContentAccessReasonCodes = [
  'content_read_missing',
  'content_update_missing',
  'context_restricted',
  'server_forbidden',
] as const;

export type IamContentStatus = (typeof iamContentStatuses)[number];
export type IamContentAccessState = (typeof iamContentAccessStates)[number];
export type IamContentAccessReasonCode = (typeof iamContentAccessReasonCodes)[number];

export type ContentJsonPrimitive = string | number | boolean | null;
export type ContentJsonValue =
  | ContentJsonPrimitive
  | { readonly [key: string]: ContentJsonValue }
  | readonly ContentJsonValue[];

type ContentPermissionView = {
  readonly action: string;
  readonly effect?: 'allow' | 'deny';
  readonly organizationId?: string;
  readonly provenance?: {
    readonly sourceKinds?: readonly ('direct_user' | 'direct_role' | 'group_role')[];
  };
};

export type IamContentAccessSummary = {
  readonly state: IamContentAccessState;
  readonly canRead: boolean;
  readonly canCreate: boolean;
  readonly canUpdate: boolean;
  readonly reasonCode?: IamContentAccessReasonCode;
  readonly organizationIds: readonly string[];
  readonly sourceKinds: readonly ('direct_user' | 'direct_role' | 'group_role')[];
};

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
  readonly access?: IamContentAccessSummary;
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

const CONTENT_READ_ACTIONS = new Set(['content.read']);
const CONTENT_CREATE_ACTIONS = new Set(['content.create']);
const CONTENT_UPDATE_ACTIONS = new Set(['content.update', 'content.write']);

const uniqueSortedStrings = (values: readonly string[]) => [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));

const uniqueSortedSourceKinds = (values: readonly ('direct_user' | 'direct_role' | 'group_role')[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const matchesActionSet = (action: string, candidates: ReadonlySet<string>) => candidates.has(action.trim());

export const summarizeContentAccess = (
  permissions: readonly ContentPermissionView[]
): IamContentAccessSummary => {
  const contentPermissions = permissions.filter((permission) => permission.action.startsWith('content.'));
  const sourceKinds = uniqueSortedSourceKinds(
    contentPermissions.flatMap((permission) => permission.provenance?.sourceKinds ?? [])
  );
  const organizationIds = uniqueSortedStrings(
    contentPermissions.flatMap((permission) => (permission.organizationId ? [permission.organizationId] : []))
  );
  const hasAllowedRead = contentPermissions.some(
    (permission) => permission.effect !== 'deny' && matchesActionSet(permission.action, CONTENT_READ_ACTIONS)
  );
  const hasAllowedCreate = contentPermissions.some(
    (permission) => permission.effect !== 'deny' && matchesActionSet(permission.action, CONTENT_CREATE_ACTIONS)
  );
  const hasAllowedUpdate = contentPermissions.some(
    (permission) => permission.effect !== 'deny' && matchesActionSet(permission.action, CONTENT_UPDATE_ACTIONS)
  );
  const hasDeniedRead = contentPermissions.some(
    (permission) => permission.effect === 'deny' && matchesActionSet(permission.action, CONTENT_READ_ACTIONS)
  );
  const hasDeniedUpdate = contentPermissions.some(
    (permission) => permission.effect === 'deny' && matchesActionSet(permission.action, CONTENT_UPDATE_ACTIONS)
  );

  if (hasAllowedRead && hasAllowedUpdate && !hasDeniedUpdate) {
    return {
      state: 'editable',
      canRead: true,
      canCreate: hasAllowedCreate,
      canUpdate: true,
      organizationIds,
      sourceKinds,
    };
  }

  if (hasAllowedRead && !hasDeniedRead) {
    return {
      state: 'read_only',
      canRead: true,
      canCreate: hasAllowedCreate,
      canUpdate: false,
      reasonCode: hasDeniedUpdate || contentPermissions.length > 0 ? 'content_update_missing' : 'context_restricted',
      organizationIds,
      sourceKinds,
    };
  }

  return {
    state: 'blocked',
    canRead: false,
    canCreate: hasAllowedCreate,
    canUpdate: false,
    reasonCode: hasDeniedRead || contentPermissions.length > 0 ? 'content_read_missing' : 'context_restricted',
    organizationIds,
    sourceKinds,
  };
};

export const withServerDeniedContentAccess = (
  access: IamContentAccessSummary | undefined
): IamContentAccessSummary => ({
  state: 'server_denied',
  canRead: access?.canRead ?? false,
  canCreate: access?.canCreate ?? false,
  canUpdate: false,
  reasonCode: 'server_forbidden',
  organizationIds: access?.organizationIds ?? [],
  sourceKinds: access?.sourceKinds ?? [],
});

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
