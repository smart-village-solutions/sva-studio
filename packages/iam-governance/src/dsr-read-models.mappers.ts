import type { IamDsrCaseListItem } from '@sva/core';

import { readString } from './input-readers.js';
import {
  mapExportJobRow,
  mapLegalHoldRow,
  mapProfileCorrectionRow,
  mapRecipientNotificationRow,
  mapRequestRow,
} from './dsr-read-models.case-mappers.js';
import type { AdminDsrSourceRows, DsrFilters } from './dsr-read-models.types.js';

export { toCanonicalDsrStatus } from './dsr-read-models.case-mappers.js';

const includesSearch = (value: string | undefined, search: string) =>
  Boolean(value?.toLowerCase().includes(search.toLowerCase()));

const matchesSearch = (item: IamDsrCaseListItem, search?: string) =>
  !search ||
  [
    item.title,
    item.summary,
    item.requestType,
    item.targetDisplayName,
    item.requesterDisplayName,
    item.actorDisplayName,
    item.rawStatus,
    item.type,
    item.format,
  ].some((value) => includesSearch(value, search));

export const buildAdminDsrItems = (rows: AdminDsrSourceRows): IamDsrCaseListItem[] => [
  ...rows.requests.map(mapRequestRow),
  ...rows.exportJobs.map(mapExportJobRow),
  ...rows.legalHolds.map(mapLegalHoldRow),
  ...rows.profileCorrections.map(mapProfileCorrectionRow),
  ...rows.recipientNotifications.map(mapRecipientNotificationRow),
];

export const filterAdminDsrItems = (
  items: readonly IamDsrCaseListItem[],
  input: DsrFilters
): IamDsrCaseListItem[] =>
  items
    .filter((item) => (input.type ? item.type === input.type : true))
    .filter((item) => (input.status ? item.canonicalStatus === input.status : true))
    .filter((item) => matchesSearch(item, readString(input.search) ?? undefined))
    .sort((left, right) => {
      const sortBy = input.sortBy ?? 'createdAt';
      const direction = (input.sortDirection ?? 'desc') === 'asc' ? 1 : -1;
      const leftValue = sortBy === 'completedAt' ? left.completedAt : left.createdAt;
      const rightValue = sortBy === 'completedAt' ? right.completedAt : right.createdAt;
      if (!leftValue && rightValue) return 1;
      if (leftValue && !rightValue) return -1;
      const result = (leftValue ?? '').localeCompare(rightValue ?? '');
      if (result !== 0) return result * direction;
      return `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`);
    });

export const paginateDsrItems = (
  items: readonly IamDsrCaseListItem[],
  page: number,
  pageSize: number
) => {
  const startIndex = (page - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
};

export {
  buildDsrSelfServiceOverview,
  buildSelfServiceActivityItemFromSourceRows,
} from './dsr-read-models.self-service-mappers.js';
