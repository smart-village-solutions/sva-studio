export const GENERIC_CONTENT_TYPE = 'generic' as const;

export const iamContentStatuses = ['draft', 'in_review', 'approved', 'published', 'archived'] as const;
export const iamContentValidationStates = ['valid', 'invalid', 'pending'] as const;
export const iamContentPrimitiveActions = [
  'content.read',
  'content.create',
  'content.updateMetadata',
  'content.updatePayload',
  'content.changeStatus',
  'content.publish',
  'content.archive',
  'content.restore',
  'content.readHistory',
  'content.manageRevisions',
  'content.delete',
] as const;
export const iamContentDomainCapabilities = [
  'content.create',
  'content.update_metadata',
  'content.update_payload',
  'content.change_status',
  'content.publish',
  'content.archive',
  'content.restore',
  'content.manage_revisions',
  'content.delete',
] as const;
export const iamContentAccessStates = ['editable', 'read_only', 'blocked', 'server_denied'] as const;
export const iamContentAccessReasonCodes = [
  'content_read_missing',
  'content_update_missing',
  'context_restricted',
  'server_forbidden',
] as const;

export type IamContentStatus = (typeof iamContentStatuses)[number];
export type IamContentValidationState = (typeof iamContentValidationStates)[number];
export type IamContentPrimitiveAction = (typeof iamContentPrimitiveActions)[number];
export type IamContentDomainCapability = (typeof iamContentDomainCapabilities)[number];
export type IamContentCapabilityMappingDiagnosticCode =
  | 'capability_mapping_missing'
  | 'capability_mapping_invalid'
  | 'capability_authorization_denied';
export type IamContentAccessState = (typeof iamContentAccessStates)[number];
export type IamContentAccessReasonCode = (typeof iamContentAccessReasonCodes)[number];

export type IamContentCapabilityMapping = {
  readonly domainCapability: IamContentDomainCapability;
  readonly primitiveAction: string;
};

export type ResolvedIamContentCapabilityMapping =
  | {
      readonly ok: true;
      readonly domainCapability: IamContentDomainCapability;
      readonly primitiveAction: IamContentPrimitiveAction;
    }
  | {
      readonly ok: false;
      readonly reasonCode: Extract<
        IamContentCapabilityMappingDiagnosticCode,
        'capability_mapping_missing' | 'capability_mapping_invalid'
      >;
      readonly domainCapability?: string;
      readonly primitiveAction?: string;
    };

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
  readonly instanceId: string;
  readonly organizationId?: string;
  readonly ownerSubjectId?: string;
  readonly title: string;
  readonly publishedAt?: string;
  readonly publishFrom?: string;
  readonly publishUntil?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
  readonly author: string;
  readonly payload: ContentJsonValue;
  readonly status: IamContentStatus;
  readonly validationState: IamContentValidationState;
  readonly historyRef: string;
  readonly currentRevisionRef?: string;
  readonly lastAuditEventRef?: string;
  readonly access?: IamContentAccessSummary;
};

export type IamContentDetail = IamContentListItem & {
  readonly history: readonly IamContentHistoryEntry[];
};

export type CreateIamContentInput = {
  readonly contentType: string;
  readonly organizationId?: string;
  readonly ownerSubjectId?: string;
  readonly title: string;
  readonly publishedAt?: string;
  readonly publishFrom?: string;
  readonly publishUntil?: string;
  readonly payload: ContentJsonValue;
  readonly status: IamContentStatus;
  readonly validationState?: IamContentValidationState;
};

export type UpdateIamContentInput = Partial<CreateIamContentInput>;

const CONTENT_READ_ACTIONS = new Set(['content.read']);
const CONTENT_CREATE_ACTIONS = new Set(['content.create']);
const CONTENT_UPDATE_ACTIONS = new Set([
  'content.updateMetadata',
  'content.updatePayload',
  'content.changeStatus',
  'content.publish',
  'content.archive',
  'content.restore',
  'content.manageRevisions',
  'content.delete',
]);

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

export const isIamContentValidationState = (value: unknown): value is IamContentValidationState =>
  typeof value === 'string' && (iamContentValidationStates as readonly string[]).includes(value);

export const isIamContentPrimitiveAction = (value: unknown): value is IamContentPrimitiveAction =>
  typeof value === 'string' && (iamContentPrimitiveActions as readonly string[]).includes(value);

export const isIamContentDomainCapability = (value: unknown): value is IamContentDomainCapability =>
  typeof value === 'string' && (iamContentDomainCapabilities as readonly string[]).includes(value);

export const iamContentCapabilityMappings = [
  { domainCapability: 'content.create', primitiveAction: 'content.create' },
  { domainCapability: 'content.update_metadata', primitiveAction: 'content.updateMetadata' },
  { domainCapability: 'content.update_payload', primitiveAction: 'content.updatePayload' },
  { domainCapability: 'content.change_status', primitiveAction: 'content.changeStatus' },
  { domainCapability: 'content.publish', primitiveAction: 'content.publish' },
  { domainCapability: 'content.archive', primitiveAction: 'content.archive' },
  { domainCapability: 'content.restore', primitiveAction: 'content.restore' },
  { domainCapability: 'content.manage_revisions', primitiveAction: 'content.manageRevisions' },
  { domainCapability: 'content.delete', primitiveAction: 'content.delete' },
] as const satisfies readonly IamContentCapabilityMapping[];

export const resolveIamContentCapabilityMapping = (
  domainCapability: unknown,
  mappings: readonly IamContentCapabilityMapping[] = iamContentCapabilityMappings
): ResolvedIamContentCapabilityMapping => {
  if (!isIamContentDomainCapability(domainCapability)) {
    return {
      ok: false,
      reasonCode: 'capability_mapping_missing',
      ...(typeof domainCapability === 'string' ? { domainCapability } : {}),
    };
  }

  const mapping = mappings.find((candidate) => candidate.domainCapability === domainCapability);
  if (!mapping) {
    return { ok: false, reasonCode: 'capability_mapping_missing', domainCapability };
  }

  if (!isIamContentPrimitiveAction(mapping.primitiveAction)) {
    return {
      ok: false,
      reasonCode: 'capability_mapping_invalid',
      domainCapability,
      primitiveAction: mapping.primitiveAction,
    };
  }

  return {
    ok: true,
    domainCapability,
    primitiveAction: mapping.primitiveAction,
  };
};

export const resolveIamContentDomainCapabilityForPrimitiveAction = (
  primitiveAction: IamContentPrimitiveAction,
  mappings: readonly IamContentCapabilityMapping[] = iamContentCapabilityMappings
): IamContentDomainCapability | undefined =>
  mappings.find((mapping) => mapping.primitiveAction === primitiveAction)?.domainCapability;

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
