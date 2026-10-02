import {
  iamContentDomainCapabilities,
  iamContentPrimitiveActions,
  iamContentStatuses,
  iamContentValidationStates,
} from './content-management-foundation.js';
import type {
  ContentJsonValue,
  IamContentCapabilityMapping,
  IamContentDomainCapability,
  IamContentPrimitiveAction,
  IamContentStatus,
  IamContentValidationState,
  ResolvedIamContentCapabilityMapping,
} from './content-management-foundation.js';

export * from './content-management-foundation.js';
export * from './content-management-contract.js';
export * from './content-management-access.js';

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
  { domainCapability: 'content.transfer_ownership', primitiveAction: 'content.transferOwnership' },
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
    readonly organizationId?: unknown;
    readonly ownerUserId?: unknown;
    readonly ownerOrganizationId?: unknown;
  },
  registeredContentTypes: readonly string[]
): readonly string[] => {
  const errors: string[] = [];

  if (
    input.organizationId !== undefined ||
    input.ownerUserId !== undefined ||
    input.ownerOrganizationId !== undefined
  ) {
    errors.push('ownership');
  }

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
