import type { IamDsrCaseListItem, IamGovernanceCaseListItem } from '@sva/core';

import { type StudioColumnDef } from '@sva/studio-ui-react';

import { t } from '../../i18n';

import {
  StatusBadge,
  formatDsrPeople,
  formatGovernanceActors,
} from './-iam-page-display';
import { formatDateTime } from './-iam-page-shared';
import {
  formatGovernanceTitle,
  mapDsrStatusToTranslationKey,
  mapDsrStatusTone,
} from './-iam.models';

export const buildGovernanceColumns = (): readonly StudioColumnDef<IamGovernanceCaseListItem>[] => [
  {
    id: 'case',
    header: t('admin.iam.governance.columns.case'),
    cell: (item) => (
      <div className="space-y-1">
        <a
          className="font-semibold text-foreground underline-offset-4 hover:underline"
          href={`/admin/iam/governance/${item.id}`}
        >
          {formatGovernanceTitle(item)}
        </a>
        <p className="text-xs text-muted-foreground">{item.summary}</p>
      </div>
    ),
  },
  {
    id: 'status',
    header: t('admin.iam.governance.columns.status'),
    cell: (item) => (
      <StatusBadge label={item.status} tone="border-secondary/40 bg-secondary/10 text-secondary" />
    ),
  },
  {
    id: 'actors',
    header: t('admin.iam.governance.columns.actors'),
    cell: (item) => formatGovernanceActors(item),
  },
  {
    id: 'ticket',
    header: t('admin.iam.governance.columns.ticket'),
    cell: (item) => item.ticketId ?? '—',
  },
  {
    id: 'createdAt',
    header: t('admin.iam.governance.columns.createdAt'),
    cell: (item) => formatDateTime(item.createdAt),
    sortable: true,
    sortLabel: t('admin.iam.governance.columns.createdAt'),
    sortValue: (item) => item.createdAt,
  },
  {
    id: 'updatedAt',
    header: t('admin.iam.governance.columns.updatedAt'),
    cell: (item) =>
      item.updatedAt ? formatDateTime(item.updatedAt) : t('admin.iam.shared.notAvailable'),
    sortable: true,
    sortLabel: t('admin.iam.governance.columns.updatedAt'),
    sortValue: (item) => item.updatedAt,
  },
];

export const buildDsrColumns = (): readonly StudioColumnDef<IamDsrCaseListItem>[] => [
  {
    id: 'case',
    header: t('admin.iam.dsr.columns.case'),
    cell: (item) => (
      <div className="space-y-1">
        <a
          className="font-semibold text-foreground underline-offset-4 hover:underline"
          href={`/admin/iam/dsr/${item.id}`}
        >
          {item.title}
        </a>
        <p className="text-xs text-muted-foreground">{item.summary}</p>
      </div>
    ),
  },
  {
    id: 'status',
    header: t('admin.iam.dsr.columns.status'),
    cell: (item) => (
      <StatusBadge label={t(mapDsrStatusToTranslationKey(item))} tone={mapDsrStatusTone(item)} />
    ),
  },
  {
    id: 'people',
    header: t('admin.iam.dsr.columns.people'),
    cell: (item) => formatDsrPeople(item),
  },
  {
    id: 'blocker',
    header: t('admin.iam.dsr.columns.blocker'),
    cell: (item) => item.blockedReason ?? '—',
  },
  {
    id: 'createdAt',
    header: t('admin.iam.dsr.columns.createdAt'),
    cell: (item) => formatDateTime(item.createdAt),
    sortable: true,
    sortLabel: t('admin.iam.dsr.columns.createdAt'),
    sortValue: (item) => item.createdAt,
  },
  {
    id: 'completedAt',
    header: t('admin.iam.dsr.columns.completedAt'),
    cell: (item) =>
      item.completedAt ? formatDateTime(item.completedAt) : t('admin.iam.shared.notAvailable'),
    sortable: true,
    sortLabel: t('admin.iam.dsr.columns.completedAt'),
    sortValue: (item) => item.completedAt,
  },
];
