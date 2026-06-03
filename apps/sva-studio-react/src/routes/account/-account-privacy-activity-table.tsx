import type { IamDsrCanonicalStatus, IamSelfServiceActivityType } from '@sva/core';
import { Link } from '@tanstack/react-router';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { t } from '../../i18n';
import {
  formatPrivacyDateTime,
  mapDsrStatusKey,
  mapDsrStatusTone,
  mapPrivacyTypeKey,
} from './-account-privacy-shared';
import type { PrivacyActivityFilters, PrivacyActivityRow } from './-account-privacy-view-model';

const canonicalStatuses: readonly PrivacyActivityFilters['status'][] = [
  'all',
  'queued',
  'in_progress',
  'completed',
  'blocked',
  'failed',
] as const;

const activityTypes: readonly PrivacyActivityFilters['type'][] = [
  'all',
  'request',
  'export_job',
  'legal_hold',
  'profile_correction',
  'recipient_notification',
  'legal_acceptance',
] as const;

const mapStatusOptionKey = (status: 'all' | IamDsrCanonicalStatus) =>
  status === 'all' ? 'account.privacy.table.filters.allStatuses' : mapDsrStatusKey(status);

const mapTypeOptionKey = (type: 'all' | IamSelfServiceActivityType) =>
  type === 'all' ? 'account.privacy.table.filters.allTypes' : mapPrivacyTypeKey(type);

export const PrivacyActivityTable = ({
  filters,
  onFilterChange,
  onDownload,
  rows,
}: Readonly<{
  filters: PrivacyActivityFilters;
  onFilterChange: (next: PrivacyActivityFilters) => void;
  onDownload: (jobId: string, format: 'json' | 'csv' | 'xml') => void;
  rows: readonly PrivacyActivityRow[];
}>) => (
  <Card>
    <CardHeader className="space-y-4">
      <div className="space-y-1">
        <CardTitle>{t('account.privacy.table.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('account.privacy.table.subtitle')}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="privacy-activity-search">{t('account.privacy.table.filters.search')}</Label>
          <Input
            id="privacy-activity-search"
            value={filters.search}
            onChange={(event) => onFilterChange({ ...filters, search: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="privacy-activity-status">{t('account.privacy.table.filters.status')}</Label>
          <Select
            id="privacy-activity-status"
            value={filters.status}
            onChange={(event) =>
              onFilterChange({
                ...filters,
                status: event.target.value as PrivacyActivityFilters['status'],
              })
            }
          >
            {canonicalStatuses.map((status) => (
              <option key={status} value={status}>
                {t(mapStatusOptionKey(status))}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="privacy-activity-type">{t('account.privacy.table.filters.type')}</Label>
          <Select
            id="privacy-activity-type"
            value={filters.type}
            onChange={(event) =>
              onFilterChange({
                ...filters,
                type: event.target.value as PrivacyActivityFilters['type'],
              })
            }
          >
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {t(mapTypeOptionKey(type))}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </CardHeader>
    <CardContent className="overflow-x-auto">
      <table className="min-w-full border-collapse" aria-label={t('account.privacy.table.ariaLabel')}>
        <thead className="bg-muted/20 text-left text-[13px] text-foreground">
          <tr className="border-b border-border/70">
            <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.type')}</th>
            <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.createdAt')}</th>
            <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.status')}</th>
            <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.updatedAt')}</th>
            <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.id')}</th>
            <th scope="col" className="px-3 py-3 text-right">{t('account.privacy.table.columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-sm text-muted-foreground" colSpan={6}>
                {t('account.privacy.table.empty')}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 align-top">
                <td className="px-3 py-3 text-sm text-foreground">{t(mapPrivacyTypeKey(row.type))}</td>
                <td className="px-3 py-3 text-sm text-muted-foreground">{formatPrivacyDateTime(row.createdAt)}</td>
                <td className="px-3 py-3">
                  <Badge className={mapDsrStatusTone(row.canonicalStatus)} variant="outline">
                    {t(mapDsrStatusKey(row.canonicalStatus))}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-sm text-muted-foreground">{formatPrivacyDateTime(row.activityAt)}</td>
                <td className="px-3 py-3 font-mono text-sm text-muted-foreground">{row.id}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild type="button" variant="outline" size="sm">
                      <Link to="/account/privacy/$caseId" params={{ caseId: row.id }}>
                        {t('account.privacy.table.actions.details')}
                      </Link>
                    </Button>
                    {row.type === 'export_job' && row.canonicalStatus === 'completed' && row.format ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownload(row.id, row.format as 'json' | 'csv' | 'xml')}
                      >
                        {t('account.privacy.table.actions.download')}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </CardContent>
  </Card>
);
