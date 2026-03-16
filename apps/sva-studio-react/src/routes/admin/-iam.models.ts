import type { AuthorizeResponse, EffectivePermission, IamDsrCaseListItem, MePermissionsResponse } from '@sva/core';

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
};

const VALID_TABS: readonly IamCockpitTabKey[] = ['rights', 'governance', 'dsr'];

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
  };
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
      includesIgnoreCase(permission.sourceRoleIds.join(' '), query) ||
      includesIgnoreCase(stringifyScope(permission.scope), query)
    );
  });
};

export const mapDsrStatusToTranslationKey = (item: Pick<IamDsrCaseListItem, 'canonicalStatus'>) => {
  switch (item.canonicalStatus) {
    case 'queued':
      return 'admin.iam.dsr.status.queued';
    case 'in_progress':
      return 'admin.iam.dsr.status.inProgress';
    case 'completed':
      return 'admin.iam.dsr.status.completed';
    case 'blocked':
      return 'admin.iam.dsr.status.blocked';
    default:
      return 'admin.iam.dsr.status.failed';
  }
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
