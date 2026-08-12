export type SidebarContentLocation = Readonly<{
  pathname: string;
  search: Readonly<Record<string, unknown>>;
}>;

type SidebarContentNavigationEntry = Readonly<{
  id: string;
  contentType?: string | null;
  activePathPrefixes?: readonly string[];
}>;

const isPathWithinPrefix = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const resolveContentNavigationActiveId = (
  location: SidebarContentLocation,
  entries: readonly SidebarContentNavigationEntry[],
  knownContentTypes: readonly string[]
): string | null => {
  if (location.pathname === '/admin/content') {
    const rawType = typeof location.search.type === 'string' ? location.search.type.trim() : '';
    const selectedType = rawType === '' || rawType === 'all' ? null : rawType;
    const matchingEntry = entries.find((entry) => entry.contentType === selectedType);
    if (matchingEntry) {
      return matchingEntry.id;
    }

    return selectedType && knownContentTypes.includes(selectedType)
      ? null
      : (entries.find((entry) => entry.contentType === null)?.id ?? null);
  }

  return (
    entries.find((entry) =>
      entry.activePathPrefixes?.some((prefix) => isPathWithinPrefix(location.pathname, prefix))
    )?.id ?? null
  );
};

export const resolveContentRoutePrefix = (path: string): string => {
  const pathname = path.split('?')[0] ?? path;
  const dynamicSegmentIndex = pathname.indexOf('/$');
  return dynamicSegmentIndex === -1 ? pathname : pathname.slice(0, dynamicSegmentIndex);
};

export const updateContentTypeSearch = (
  current: Readonly<Record<string, unknown>>,
  contentType: string | null
): Record<string, unknown> => {
  const legacyFilters =
    current.filters && typeof current.filters === 'object'
      ? (current.filters as Readonly<Record<string, unknown>>)
      : undefined;
  const { filters: _filters, type: _type, page: _page, ...remaining } = current;
  const status = current.status ?? legacyFilters?.status;

  return {
    ...remaining,
    ...(status !== undefined ? { status } : {}),
    ...(contentType ? { type: contentType } : {}),
    page: 1,
  };
};
