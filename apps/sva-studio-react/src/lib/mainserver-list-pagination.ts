export const mainserverListDefaultPageSize = 25;
export const mainserverListAllowedPageSizes = [25, 50, 100] as const;
export const mainserverListMaxOffset = 10_000;

export type MainserverListQuery = {
  readonly page: number;
  readonly pageSize: number;
};

const readPositiveInteger = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === value ? parsed : undefined;
};

export const parseMainserverListQuery = (request: Request): MainserverListQuery => {
  const { searchParams } = new URL(request.url);
  const requestedPageSize = readPositiveInteger(searchParams.get('pageSize'));
  const pageSize =
    requestedPageSize && mainserverListAllowedPageSizes.includes(requestedPageSize as (typeof mainserverListAllowedPageSizes)[number])
      ? requestedPageSize
      : mainserverListDefaultPageSize;
  const maxPage = Math.floor(mainserverListMaxOffset / pageSize) + 1;
  const page = Math.min(readPositiveInteger(searchParams.get('page')) ?? 1, maxPage);

  return { page, pageSize };
};
