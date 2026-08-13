export type MainserverProjectionScope = Readonly<{
  instanceId: string;
  actorAccountId: string;
  activeOrganizationId?: string;
  actingPrincipalType?: 'organization' | 'user';
  contentType: string;
}>;

export const buildMainserverProjectionScopeKey = (scope: MainserverProjectionScope): string => {
  if (scope.actorAccountId.trim().length === 0) {
    throw new Error('mainserver_projection_scope_requires_actor_account_id');
  }

  return [
    scope.instanceId,
    scope.actorAccountId,
    scope.activeOrganizationId ?? 'no-organization',
    ...(scope.actingPrincipalType ? [scope.actingPrincipalType] : []),
    scope.contentType,
  ].join('::');
};
