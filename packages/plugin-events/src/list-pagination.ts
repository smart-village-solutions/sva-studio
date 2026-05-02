const allowedListPageSizes = [25, 50, 100] as const;
const defaultListPageSize = 25;
const maxListOffset = 10_000;

export type ListSearch = {
  readonly page?: number;
  readonly pageSize?: number;
};

export const normalizeListSearch = (search: ListSearch) => {
  const pageSize = allowedListPageSizes.includes(search.pageSize as (typeof allowedListPageSizes)[number])
    ? search.pageSize
    : defaultListPageSize;
  const maxPage = Math.floor(maxListOffset / pageSize) + 1;
  const page =
    typeof search.page === 'number' && Number.isInteger(search.page) && search.page > 0 ? Math.min(search.page, maxPage) : 1;

  return { page, pageSize };
};
