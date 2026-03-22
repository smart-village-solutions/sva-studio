import { Link } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { useContents } from '../../hooks/use-contents';
import { t } from '../../i18n';
import type { IamHttpError } from '../../lib/iam-api';

type StatusFilter = 'all' | 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

const contentErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('content.messages.loadError');
  }

  switch (error.code) {
    case 'forbidden':
      return t('content.errors.forbidden');
    case 'database_unavailable':
      return t('content.errors.databaseUnavailable');
    default:
      return t('content.messages.loadError');
  }
};

const formatDateTime = (value?: string): string => {
  if (!value) {
    return t('content.table.notPublished');
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const summarizePayload = (value: unknown): string => {
  const json = JSON.stringify(value);
  if (!json) {
    return '{}';
  }
  return json.length <= 80 ? json : `${json.slice(0, 77)}...`;
};

const stringifyPayload = (value: unknown): string => JSON.stringify(value) ?? '';

const renderContentListBody = ({
  isLoading,
  filteredContents,
}: {
  isLoading: boolean;
  filteredContents: ReturnType<typeof useContents>['contents'];
}) => {
  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">{t('content.messages.loading')}</div>;
  }

  if (filteredContents.length === 0) {
    return (
      <div className="space-y-2 p-6">
        <h2 className="text-lg font-semibold text-foreground">{t('content.empty.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('content.empty.body')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border" aria-label={t('content.table.ariaLabel')}>
        <caption className="sr-only">{t('content.table.caption')}</caption>
        <thead className="bg-muted/30">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('content.table.headerTitle')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('content.table.headerType')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('content.table.headerPublished')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('content.table.headerCreated')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('content.table.headerUpdated')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('content.table.headerAuthor')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('content.table.headerPayload')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('content.table.headerStatus')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('content.table.headerActions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filteredContents.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="px-4 py-3 text-sm font-medium text-foreground">{item.title}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{item.contentType}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateTime(item.publishedAt)}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateTime(item.createdAt)}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateTime(item.updatedAt)}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{item.author}</td>
              <td className="max-w-sm px-4 py-3 text-sm text-foreground">{summarizePayload(item.payload)}</td>
              <td className="px-4 py-3 text-sm text-foreground">
                <Badge variant={statusVariantByValue[item.status]}>{t(statusLabelKeyByValue[item.status])}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Button asChild size="sm" variant="outline">
                  <Link to="/content/$contentId" params={{ contentId: item.id }}>
                    {t('content.actions.edit')}
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const statusVariantByValue = {
  draft: 'outline',
  in_review: 'secondary',
  approved: 'default',
  published: 'default',
  archived: 'destructive',
} as const;

const statusLabelKeyByValue = {
  draft: 'content.status.draft',
  in_review: 'content.status.inReview',
  approved: 'content.status.approved',
  published: 'content.status.published',
  archived: 'content.status.archived',
} as const;

export const ContentListPage = () => {
  const contentsApi = useContents();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const normalizedSearch = search.trim().toLowerCase();

  const contentsWithPayloadJson = React.useMemo(
    () =>
      contentsApi.contents.map((item) => ({
        ...item,
        payloadJson: stringifyPayload(item.payload),
      })),
    [contentsApi.contents]
  );

  const filteredContents = contentsWithPayloadJson.filter((item) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      item.title.toLowerCase().includes(normalizedSearch) ||
      item.author.toLowerCase().includes(normalizedSearch) ||
      item.contentType.toLowerCase().includes(normalizedSearch) ||
      item.payloadJson.toLowerCase().includes(normalizedSearch);

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <section className="space-y-5" aria-busy={contentsApi.isLoading}>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('content.page.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('content.page.subtitle')}</p>
        </div>
        <Button asChild>
          <Link to="/content/new">{t('content.actions.create')}</Link>
        </Button>
      </header>

      {contentsApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
          <AlertDescription>{contentErrorMessage(contentsApi.error)}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="grid gap-3 p-4 lg:grid-cols-[1fr_14rem]">
        <div className="flex flex-col gap-1">
          <Label htmlFor="content-search">{t('content.filters.searchLabel')}</Label>
          <Input
            id="content-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('content.filters.searchPlaceholder')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="content-status-filter">{t('content.filters.statusLabel')}</Label>
          <Select
            id="content-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">{t('content.filters.statusAll')}</option>
            <option value="draft">{t('content.status.draft')}</option>
            <option value="in_review">{t('content.status.inReview')}</option>
            <option value="approved">{t('content.status.approved')}</option>
            <option value="published">{t('content.status.published')}</option>
            <option value="archived">{t('content.status.archived')}</option>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">{renderContentListBody({ isLoading: contentsApi.isLoading, filteredContents })}</Card>
    </section>
  );
};
