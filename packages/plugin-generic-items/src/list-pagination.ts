export const normalizeListSearch = (search: { readonly page?: number; readonly pageSize?: number }) => ({
  page: Number.isInteger(search.page) && (search.page ?? 0) > 0 ? (search.page as number) : 1,
  pageSize: search.pageSize === 50 || search.pageSize === 100 ? search.pageSize : 25,
});
