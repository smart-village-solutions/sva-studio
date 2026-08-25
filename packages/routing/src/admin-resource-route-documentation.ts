import {
  defineRouteDocumentation,
  type DocumentationPageType,
  type RouteDocumentation,
} from '@sva/plugin-sdk/route-documentation';

export const createAdminResourceRouteDocumentation = (definition: {
  readonly resource: Readonly<{ resourceId: string }>;
  readonly routeKind: DocumentationPageType;
}): RouteDocumentation =>
  defineRouteDocumentation({
    kind: 'page',
    id: `${definition.resource.resourceId}.${definition.routeKind}`,
    pageType: definition.routeKind,
  });
