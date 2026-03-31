import type { AuthorizeResponse, EffectivePermission, IamDsrCaseListItem, MePermissionsResponse } from '@sva/core';
import { t } from '../../i18n';

import type { IamCockpitTabKey } from '../../lib/iam-viewer-access';

export type IamPermissionsQuery = {
  readonly instanceId: string;
  readonly organizationId?: string;
  readonly actingAsUserId?: string;
};

export type IamPermissionsResponse = MePermissionsResponse;

export type AuthorizeDecisionViewModel = {
  readonly allowed: boolean;
  readonly reason: string;
  readonly reasonCode?: string;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
  readonly evaluatedAt?: string;
  readonly provenance?: AuthorizeResponse['provenance'];
  readonly matchedPermissions?: AuthorizeResponse['matchedPermissions'];
};

const VALID_TABS: readonly IamCockpitTabKey[] = ['rights', 'governance', 'dsr'];
const TAB_TRANSLATION_KEY_BY_VALUE = {
  rights: 'admin.iam.tabs.rights',
  governance: 'admin.iam.tabs.governance',
  dsr: 'admin.iam.tabs.dsr',
} as const satisfies Record<IamCockpitTabKey, string>;

const GOVERNANCE_TYPE_TRANSLATION_KEY_BY_VALUE = {
  permission_change: 'admin.iam.governance.types.permission_change',
  delegation: 'admin.iam.governance.types.delegation',
  impersonation: 'admin.iam.governance.types.impersonation',
  legal_acceptance: 'admin.iam.governance.types.legal_acceptance',
} as const;

const DSR_TYPE_TRANSLATION_KEY_BY_VALUE = {
  request: 'admin.iam.dsr.types.request',
  export_job: 'admin.iam.dsr.types.export_job',
  legal_hold: 'admin.iam.dsr.types.legal_hold',
  profile_correction: 'admin.iam.dsr.types.profile_correction',
  recipient_notification: 'admin.iam.dsr.types.recipient_notification',
} as const;

const DSR_STATUS_TRANSLATION_KEY_BY_VALUE = {
  queued: 'admin.iam.dsr.status.queued',
  in_progress: 'admin.iam.dsr.status.inProgress',
  completed: 'admin.iam.dsr.status.completed',
  blocked: 'admin.iam.dsr.status.blocked',
  failed: 'admin.iam.dsr.status.failed',
} as const;

const readReasonCodeFromDiagnostics = (diagnostics: unknown): string | undefined => {
  if (!diagnostics || typeof diagnostics !== 'object') {
    return undefined;
  }
  const reasonCode = (diagnostics as Record<string, unknown>).reason_code;
  return typeof reasonCode === 'string' && reasonCode.length > 0 ? reasonCode : undefined;
};

export const mapAuthorizeDecision = (response: AuthorizeResponse): AuthorizeDecisionViewModel => {
  return {
    allowed: response.allowed,
    reason: response.reason,
    reasonCode: readReasonCodeFromDiagnostics(response.diagnostics),
    diagnostics: response.diagnostics,
    evaluatedAt: response.evaluatedAt,
    provenance: response.provenance,
    matchedPermissions: response.matchedPermissions,
  };
};

const mapSourceKindToLabel = (sourceKind: string): string => {
  switch (sourceKind) {
    case 'direct_user':
    case 'user':
      return t('admin.iam.rights.permissionSource.user');
    case 'direct_role':
    case 'role':
      return t('admin.iam.rights.permissionSource.role');
    case 'group_role':
    case 'group':
      return t('admin.iam.rights.permissionSource.group');
    case 'delegation':
      return t('admin.iam.rights.permissionSource.delegation');
    default:
      return sourceKind;
  }
};

export const formatPermissionSourceKindLabels = (sourceKinds: readonly string[] | undefined): string => {
  if (!sourceKinds || sourceKinds.length === 0) {
    return '—';
  }
  return sourceKinds.map(mapSourceKindToLabel).join(', ');
};

export const formatPermissionSourceKinds = (permission: EffectivePermission): string => {
  const sourceKinds = permission.provenance?.sourceKinds ?? [];
  return formatPermissionSourceKindLabels(sourceKinds);
};

const includesIgnoreCase = (haystack: string | undefined, needle: string) =>
  Boolean(haystack?.toLowerCase().includes(needle.toLowerCase()));

const stringifyScope = (scope: Readonly<Record<string, unknown>> | undefined) => {
  if (!scope) {
    return '';
  }
  return Object.entries(scope)
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(' ');
};

export const normalizeIamTab = (value: unknown): IamCockpitTabKey => {
  if (typeof value !== 'string') {
    return 'rights';
  }
  return (VALID_TABS.find((entry) => entry === value) ?? 'rights') as IamCockpitTabKey;
};

export const getFirstAllowedTab = (allowedTabs: readonly IamCockpitTabKey[]): IamCockpitTabKey =>
  allowedTabs[0] ?? 'rights';

export const mapIamTabToTranslationKey = (tab: IamCockpitTabKey) => TAB_TRANSLATION_KEY_BY_VALUE[tab];

export const mapGovernanceTypeToTranslationKey = (
  value: keyof typeof GOVERNANCE_TYPE_TRANSLATION_KEY_BY_VALUE
) => GOVERNANCE_TYPE_TRANSLATION_KEY_BY_VALUE[value];

export const mapDsrTypeToTranslationKey = (value: keyof typeof DSR_TYPE_TRANSLATION_KEY_BY_VALUE) =>
  DSR_TYPE_TRANSLATION_KEY_BY_VALUE[value];

export const mapDsrCanonicalStatusToTranslationKey = (
  value: keyof typeof DSR_STATUS_TRANSLATION_KEY_BY_VALUE
) => DSR_STATUS_TRANSLATION_KEY_BY_VALUE[value];

export const filterPermissions = (
  permissions: readonly EffectivePermission[],
  input: {
    readonly query?: string;
    readonly organizationIds?: readonly string[];
  }
): EffectivePermission[] => {
  const query = input.query?.trim() ?? '';
  const selectedOrganizationIds = new Set(
    (input.organizationIds ?? []).map((organizationId) => organizationId.trim()).filter(Boolean)
  );

  return permissions.filter((permission) => {
    if (selectedOrganizationIds.size > 0) {
      const organizationId = permission.organizationId ?? '';
      if (!selectedOrganizationIds.has(organizationId)) {
        return false;
      }
    }

    if (!query) {
      return true;
    }

    return (
      includesIgnoreCase(permission.action, query) ||
      includesIgnoreCase(permission.resourceType, query) ||
      includesIgnoreCase(permission.resourceId, query) ||
      includesIgnoreCase(permission.organizationId, query) ||
      includesIgnoreCase(permission.effect, query) ||
      includesIgnoreCase((permission.sourceRoleIds ?? []).join(' '), query) ||
      includesIgnoreCase((permission.sourceGroupIds ?? []).join(' '), query) ||
      includesIgnoreCase(
        permission.provenance
          ? Object.values(permission.provenance)
              .map((value) => String(value))
              .join(' ')
          : undefined,
        query
      ) ||
      includesIgnoreCase(stringifyScope(permission.scope), query)
    );
  });
};

export const mapDsrStatusToTranslationKey = (item: Pick<IamDsrCaseListItem, 'canonicalStatus'>) => {
  return mapDsrCanonicalStatusToTranslationKey(item.canonicalStatus);
};

export const mapDsrStatusTone = (item: Pick<IamDsrCaseListItem, 'canonicalStatus'>) => {
  switch (item.canonicalStatus) {
    case 'completed':
      return 'border-primary/40 bg-primary/10 text-primary';
    case 'blocked':
    case 'failed':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    default:
      return 'border-secondary/40 bg-secondary/10 text-secondary';
  }
};
