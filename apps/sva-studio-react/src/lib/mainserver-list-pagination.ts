export const mainserverListDefaultPageSize = 25;
export const mainserverListAllowedPageSizes = [25, 50, 100] as const;

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
  const page = readPositiveInteger(searchParams.get('page')) ?? 1;
  const requestedPageSize = readPositiveInteger(searchParams.get('pageSize'));
  const pageSize =
    requestedPageSize && mainserverListAllowedPageSizes.includes(requestedPageSize as (typeof mainserverListAllowedPageSizes)[number])
      ? requestedPageSize
      : mainserverListDefaultPageSize;

  return { page, pageSize };
};
