import type {
  IamContentAccessReasonCode,
  IamContentAccessState,
} from './content-management-access-state.js';

type ContentPermissionView = {
  readonly action: string;
  readonly organizationId?: string;
  readonly provenance?: {
    readonly sourceKinds?: readonly ('direct_role' | 'group_role')[];
  };
};

export type IamContentAccessSummary = {
  readonly state: IamContentAccessState;
  readonly canRead: boolean;
  readonly canCreate: boolean;
  readonly canUpdate: boolean;
  readonly reasonCode?: IamContentAccessReasonCode;
  readonly organizationIds: readonly string[];
  readonly sourceKinds: readonly ('direct_role' | 'group_role')[];
};
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

const uniqueSortedStrings = (values: readonly string[]) =>
  [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));

const uniqueSortedSourceKinds = (values: readonly ('direct_role' | 'group_role')[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const matchesActionSet = (action: string, candidates: ReadonlySet<string>) =>
  candidates.has(action.trim());

export const summarizeContentAccess = (
  permissions: readonly ContentPermissionView[]
): IamContentAccessSummary => {
  const contentPermissions = permissions.filter((permission) =>
    permission.action.startsWith('content.')
  );
  const sourceKinds = uniqueSortedSourceKinds(
    contentPermissions.flatMap((permission) => permission.provenance?.sourceKinds ?? [])
  );
  const organizationIds = uniqueSortedStrings(
    contentPermissions.flatMap((permission) =>
      permission.organizationId ? [permission.organizationId] : []
    )
  );
  const hasAllowedRead = contentPermissions.some((permission) =>
    matchesActionSet(permission.action, CONTENT_READ_ACTIONS)
  );
  const hasAllowedCreate = contentPermissions.some((permission) =>
    matchesActionSet(permission.action, CONTENT_CREATE_ACTIONS)
  );
  const hasAllowedUpdate = contentPermissions.some((permission) =>
    matchesActionSet(permission.action, CONTENT_UPDATE_ACTIONS)
  );

  if (hasAllowedRead && hasAllowedUpdate) {
    return {
      state: 'editable',
      canRead: true,
      canCreate: hasAllowedCreate,
      canUpdate: true,
      organizationIds,
      sourceKinds,
    };
  }

  if (hasAllowedRead) {
    return {
      state: 'read_only',
      canRead: true,
      canCreate: hasAllowedCreate,
      canUpdate: false,
      reasonCode: contentPermissions.length > 0 ? 'content_update_missing' : 'context_restricted',
      organizationIds,
      sourceKinds,
    };
  }

  return {
    state: 'blocked',
    canRead: false,
    canCreate: hasAllowedCreate,
    canUpdate: false,
    reasonCode: contentPermissions.length > 0 ? 'content_read_missing' : 'context_restricted',
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
