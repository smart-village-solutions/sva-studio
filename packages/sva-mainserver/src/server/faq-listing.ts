import type { listSvaMainserverGenericItems } from './service.js';
import { SvaMainserverError } from './errors.js';

const faqTitleCollator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
const MAX_FAQ_UPSTREAM_PAGES = 500;

type GenericItem = Awaited<ReturnType<typeof listSvaMainserverGenericItems>>['data'][number];

const readSortValues = (item: GenericItem) => {
  const payload = item.payload;
  const record = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  return {
    languageCode: typeof record.languageCode === 'string' ? record.languageCode : 'und',
    sortWeight: typeof record.sortWeight === 'number' && Number.isInteger(record.sortWeight) ? record.sortWeight : 0,
  };
};

export const compareFaqItems = (left: GenericItem, right: GenericItem) => {
  const leftValues = readSortValues(left);
  const rightValues = readSortValues(right);
  return leftValues.languageCode.localeCompare(rightValues.languageCode) || leftValues.sortWeight - rightValues.sortWeight || faqTitleCollator.compare(left.title, right.title) || left.id.localeCompare(right.id);
};

export const listFaqItems = async (
  input: Parameters<typeof listSvaMainserverGenericItems>[0],
  listItems: typeof listSvaMainserverGenericItems
) => {
  const items: GenericItem[] = [];
  let page = 1;
  let hasNextPage = true;
  while (hasNextPage) {
    if (page > MAX_FAQ_UPSTREAM_PAGES) {
      throw new SvaMainserverError({
        code: 'invalid_response',
        message: 'FAQ-Auflistung überschreitet das erlaubte Upstream-Seitenlimit.',
        statusCode: 502,
      });
    }
    const result = await listItems({ ...input, page, pageSize: 100 });
    items.push(...result.data.filter((item) => item.genericType === 'FAQ'));
    hasNextPage = result.pagination.hasNextPage;
    page += 1;
  }
  items.sort(compareFaqItems);
  const start = (input.page - 1) * input.pageSize;
  return {
    data: items.slice(start, start + input.pageSize),
    pagination: { page: input.page, pageSize: input.pageSize, hasNextPage: start + input.pageSize < items.length, total: items.length },
    observability: { upstreamPageCount: page - 1, matchingItemCount: items.length },
  };
};
