const documentationPageTypes = [
  'overview',
  'list',
  'create',
  'detail',
  'history',
  'setup',
  'usage',
] as const;

export type DocumentationPageType = (typeof documentationPageTypes)[number];

export type DocumentationPageId = string;

export type RouteDocumentationExclusionReason =
  | 'help-page'
  | 'technical'
  | 'redirect'
  | 'error-page';

export type RouteDocumentation =
  | Readonly<{
      kind: 'page';
      id: DocumentationPageId;
      pageType: DocumentationPageType;
    }>
  | Readonly<{
      kind: 'excluded';
      reason: RouteDocumentationExclusionReason;
    }>;

const documentationPageIdPattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;

const exclusionReasons = new Set<RouteDocumentationExclusionReason>([
  'help-page',
  'technical',
  'redirect',
  'error-page',
]);

export const isDocumentationPageType = (value: unknown): value is DocumentationPageType =>
  typeof value === 'string' && documentationPageTypes.includes(value as DocumentationPageType);

export const normalizeDocumentationPageId = (value: string): DocumentationPageId => {
  const normalized = value.trim().toLowerCase();
  if (!documentationPageIdPattern.test(normalized)) {
    throw new Error(`invalid_documentation_page_id:${normalized || 'missing'}`);
  }
  return normalized;
};

export const defineRouteDocumentation = (
  documentation: RouteDocumentation
): RouteDocumentation => {
  if (documentation.kind === 'page') {
    if (!isDocumentationPageType(documentation.pageType)) {
      throw new Error(`invalid_documentation_page_type:${String(documentation.pageType)}`);
    }
    return {
      kind: 'page',
      id: normalizeDocumentationPageId(documentation.id),
      pageType: documentation.pageType,
    };
  }

  if (!exclusionReasons.has(documentation.reason)) {
    throw new Error(`invalid_route_documentation_exclusion:${String(documentation.reason)}`);
  }

  return documentation;
};

export const assertPluginRouteDocumentation = (
  pluginNamespace: string,
  routeId: string,
  documentation: RouteDocumentation | undefined
): RouteDocumentation => {
  if (!documentation) {
    throw new Error(`plugin_route_documentation_missing:${pluginNamespace}:${routeId}`);
  }

  const normalized = defineRouteDocumentation(documentation);
  if (normalized.kind === 'page' && !normalized.id.startsWith(`${pluginNamespace}.`)) {
    throw new Error(
      `plugin_route_documentation_owner_mismatch:${pluginNamespace}:${routeId}:${normalized.id}`
    );
  }

  return normalized;
};
