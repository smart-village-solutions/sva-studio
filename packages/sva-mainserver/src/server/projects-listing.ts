import { SvaMainserverError } from './errors.js';
import type { listSvaMainserverGenericItems } from './service.js';

const MAX_UPSTREAM_PAGES = 500;
type GenericItem = Awaited<ReturnType<typeof listSvaMainserverGenericItems>>['data'][number];

const isDeleted = (item: GenericItem): boolean => {
  const payload =
    item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
      ? (item.payload as Record<string, unknown>)
      : {};
  return payload.deleted === true;
};

export const listAllActiveProjectItems = async (
  input: Parameters<typeof listSvaMainserverGenericItems>[0],
  listItems: typeof listSvaMainserverGenericItems
) => {
  const upstreamItems: GenericItem[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    if (page > MAX_UPSTREAM_PAGES) {
      throw new SvaMainserverError({
        code: 'invalid_response',
        message: 'Projekt-Auflistung überschreitet das erlaubte Upstream-Seitenlimit.',
        statusCode: 502,
      });
    }
    const result = await listItems({ ...input, page, pageSize: 100, includeInvisible: true });
    upstreamItems.push(...result.data);
    hasNextPage = result.pagination.hasNextPage;
    page += 1;
  }

  const data = upstreamItems.filter(
    (item) => item.genericType === 'FeaturedProject' && !isDeleted(item)
  );
  return {
    data,
    observability: {
      upstreamPageCount: page - 1,
      upstreamItemCount: upstreamItems.length,
      matchingItemCount: data.length,
    },
  };
};
