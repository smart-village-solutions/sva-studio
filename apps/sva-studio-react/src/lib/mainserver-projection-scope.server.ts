export type MainserverProjectionScope = Readonly<{
  instanceId: string;
  actorAccountId: string;
  activeOrganizationId?: string;
  contentType: string;
}>;

export const buildMainserverProjectionScopeKey = (
  scope: MainserverProjectionScope
): string =>
  [
    scope.instanceId,
    scope.actorAccountId,
    scope.activeOrganizationId ?? 'no-organization',
    scope.contentType,
  ].join('::');
