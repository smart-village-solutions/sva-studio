import type {
  IamDsrCanonicalStatus,
  IamDsrSelfServiceOverview,
  IamSelfServiceActivityItem,
  IamSelfServiceActivityType,
} from '@sva/core';

export type PrivacyActivityRow = IamSelfServiceActivityItem & {
  readonly activityAt: string;
};

export type PrivacyActivityFilters = {
  readonly search: string;
  readonly status: 'all' | IamDsrCanonicalStatus;
  readonly type: 'all' | IamSelfServiceActivityType;
};

export const defaultPrivacyActivityFilters: PrivacyActivityFilters = {
  search: '',
  status: 'all',
  type: 'all',
};

export const buildPrivacyActivityRows = (
  overview: IamDsrSelfServiceOverview | null
): readonly PrivacyActivityRow[] =>
  (overview?.activityItems ?? [])
    .map((item) => ({
      ...item,
      activityAt: item.completedAt ?? item.updatedAt ?? item.createdAt,
    }))
    .sort((left, right) => right.activityAt.localeCompare(left.activityAt));

export const filterPrivacyActivityRows = (
  rows: readonly PrivacyActivityRow[],
  filters: PrivacyActivityFilters
): readonly PrivacyActivityRow[] =>
  rows.filter((row) => {
    const matchesStatus = filters.status === 'all' || row.canonicalStatus === filters.status;
    const matchesType = filters.type === 'all' || row.type === filters.type;
    const search = filters.search.trim().toLowerCase();
    const matchesSearch =
      search.length === 0 ||
      [row.id, row.title, row.summary, row.rawStatus, row.type, row.format ?? '']
        .join(' ')
        .toLowerCase()
        .includes(search);

    return matchesStatus && matchesType && matchesSearch;
  });
