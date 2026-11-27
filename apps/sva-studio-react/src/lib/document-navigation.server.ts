import type { IamOrganizationContext } from '@sva/core';

import type { DocumentNavigation } from '../components/sidebar-access';
import type { AuthMeResponse } from '../providers/auth-provider-types';
import type { MePermissionsResponse } from '../providers/effective-access-permissions';

export const loadDocumentNavigation = async (
  request: Request
): Promise<{ initiallyAuthenticated?: true; navigation?: DocumentNavigation }> => {
  const { dispatchAuthRouteRequest } = await import('@sva/routing/server');
  // Only forward session and origin headers. The document does not support delegated API identities.
  const headers = new Headers();
  for (const name of ['cookie', 'host', 'forwarded', 'x-forwarded-host', 'x-forwarded-proto']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const read = async <T>(path: string): Promise<T | undefined> => {
    const response = await dispatchAuthRouteRequest(
      new Request(new URL(path, request.url), { headers })
    );
    return response?.ok ? (await response.json()) as T : undefined;
  };

  const session = await read<AuthMeResponse>('/auth/me');
  if (!session?.user?.id) return {};
  const { id, instanceId, instanceDisplayName, roles, assignedModules } = session.user;
  const confirmed = { initiallyAuthenticated: true } as const;
  const user = { id, instanceId, instanceDisplayName, roles, assignedModules };

  if (!instanceId) {
    return { ...confirmed, navigation: { user, organizationId: null, permissions: [] } };
  }

  const context = await read<{ data: IamOrganizationContext }>('/api/v1/iam/me/context');
  if (!context?.data) return confirmed;
  const organizationId = context.data.activeOrganizationId ?? null;
  const query = new URLSearchParams({ instanceId });
  if (organizationId) query.set('organizationId', organizationId);

  const result = await read<MePermissionsResponse>(`/iam/me/permissions?${query}`);
  if (
    !result ||
    result.instanceId !== instanceId ||
    (result.organizationId ?? null) !== organizationId ||
    result.subject?.actorUserId !== id ||
    result.subject.effectiveUserId !== id ||
    !Array.isArray(result.permissions)
  ) {
    return confirmed;
  }

  // The menu needs action and scope, not the roles, groups or provenance attached to each grant.
  const permissions = result.permissions.map(
    ({ action, resourceType, accessScope, resourceId, organizationId, geoScope, scope }) => ({
      action,
      resourceType,
      accessScope,
      resourceId,
      organizationId,
      geoScope,
      scope,
    })
  );
  return { ...confirmed, navigation: { user, organizationId, permissions } };
};
