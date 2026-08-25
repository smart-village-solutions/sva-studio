import type { RouteDocumentation } from '@sva/plugin-sdk/route-documentation';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    documentation?: RouteDocumentation;
  }
}

export type DocumentationPageCatalogOwner =
  | Readonly<{ kind: 'host' }>
  | Readonly<{ kind: 'plugin'; pluginId: string }>;

export type DocumentationPageCatalogEntry = Readonly<{
  id: string;
  path: string;
  pageType: Extract<RouteDocumentation, { kind: 'page' }>['pageType'];
  owner: DocumentationPageCatalogOwner;
  titleKey?: string;
}>;

export type DocumentationPageCatalog = Readonly<{
  schemaVersion: 1;
  pages: readonly DocumentationPageCatalogEntry[];
}>;

export const toDocumentationPageCatalogEntry = (input: {
  readonly documentation: RouteDocumentation;
  readonly path: string;
  readonly owner: DocumentationPageCatalogOwner;
  readonly titleKey?: string;
}): DocumentationPageCatalogEntry | null =>
  input.documentation.kind === 'page'
    ? {
        id: input.documentation.id,
        path: input.path,
        pageType: input.documentation.pageType,
        owner: input.owner,
        ...(input.titleKey ? { titleKey: input.titleKey } : {}),
      }
    : null;

const compareCatalogEntries = (
  left: DocumentationPageCatalogEntry,
  right: DocumentationPageCatalogEntry
): number => left.id.localeCompare(right.id, 'en');

export const createDocumentationPageCatalog = (
  entries: readonly DocumentationPageCatalogEntry[]
): DocumentationPageCatalog => {
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const entry of entries) {
    if (ids.has(entry.id)) {
      throw new Error(`duplicate_documentation_page_id:${entry.id}`);
    }
    if (paths.has(entry.path)) {
      throw new Error(`duplicate_documentation_page_path:${entry.path}`);
    }
    ids.add(entry.id);
    paths.add(entry.path);
  }

  return {
    schemaVersion: 1,
    pages: [...entries].sort(compareCatalogEntries),
  };
};

export const resolveActiveRouteDocumentation = (
  matches: readonly Readonly<{ staticData?: { documentation?: RouteDocumentation } }>[]
): RouteDocumentation | null => {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const documentation = matches[index]?.staticData?.documentation;
    if (documentation) {
      return documentation;
    }
  }
  return null;
};
