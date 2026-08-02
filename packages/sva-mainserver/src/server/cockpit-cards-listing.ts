import { SvaMainserverError } from './errors.js';
import type { listSvaMainserverGenericItems } from './service.js';

const titleCollator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
const MAX_UPSTREAM_PAGES = 500;
type GenericItem = Awaited<ReturnType<typeof listSvaMainserverGenericItems>>['data'][number];

const readSortValues = (item: GenericItem) => {
  const payload =
    item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
      ? (item.payload as Record<string, unknown>)
      : {};
  return {
    languageCode: typeof payload.languageCode === 'string' ? payload.languageCode : 'und',
    sortWeight:
      typeof payload.sortWeight === 'number' && Number.isInteger(payload.sortWeight)
        ? payload.sortWeight
        : 0,
  };
};

export const compareCockpitCardItems = (left: GenericItem, right: GenericItem) => {
  const leftValues = readSortValues(left);
  const rightValues = readSortValues(right);
  return (
    leftValues.languageCode.localeCompare(rightValues.languageCode) ||
    leftValues.sortWeight - rightValues.sortWeight ||
    titleCollator.compare(left.title, right.title) ||
    left.id.localeCompare(right.id)
  );
};

export const listCockpitCardItems = async (
  input: Parameters<typeof listSvaMainserverGenericItems>[0],
  listItems: typeof listSvaMainserverGenericItems
) => {
  const items: GenericItem[] = [];
  let page = 1;
  let hasNextPage = true;
  while (hasNextPage) {
    if (page > MAX_UPSTREAM_PAGES)
      throw new SvaMainserverError({
        code: 'invalid_response',
        message: 'Cockpit-Cards-Auflistung überschreitet das erlaubte Upstream-Seitenlimit.',
        statusCode: 502,
      });
    const result = await listItems({ ...input, page, pageSize: 100 });
    items.push(...result.data.filter((item) => item.genericType === 'COCKPIT_CARD'));
    hasNextPage = result.pagination.hasNextPage;
    page += 1;
  }
  items.sort(compareCockpitCardItems);
  const start = (input.page - 1) * input.pageSize;
  return {
    data: items.slice(start, start + input.pageSize),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      hasNextPage: start + input.pageSize < items.length,
      total: items.length,
    },
    observability: { upstreamPageCount: page - 1, matchingItemCount: items.length },
  };
};
