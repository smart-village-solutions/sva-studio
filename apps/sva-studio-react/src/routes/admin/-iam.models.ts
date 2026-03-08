import type { AuthorizeResponse, EffectivePermission, MePermissionsResponse } from '@sva/core';

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
      includesIgnoreCase(permission.organizationId, query)
    );
  });
};

