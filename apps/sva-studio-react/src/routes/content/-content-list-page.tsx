import { withServerDeniedContentAccess, type IamContentAccessSummary } from '@sva/core';
import { Link } from '@tanstack/react-router';
import React from 'react';

import { StudioDataTable, type StudioColumnDef } from '../../components/StudioDataTable';
import { StudioListPageTemplate } from '../../components/StudioListPageTemplate';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { useContentAccess } from '../../hooks/use-content-access';
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

const resolveRowAccess = (
  access: IamContentAccessSummary | undefined,
  listError: IamHttpError | null
): IamContentAccessSummary => {
  if (access) {
    return access;
  }
  if (listError?.code === 'forbidden') {
    return withServerDeniedContentAccess(undefined);
  }
  return {
    state: 'read_only',
    canRead: true,
    canCreate: false,
    canUpdate: false,
    reasonCode: 'content_update_missing',
    organizationIds: [],
    sourceKinds: [],
  };
};

const contentAccessLabelKeyByState = {
  editable: 'content.access.states.editable',
  read_only: 'content.access.states.readOnly',
  blocked: 'content.access.states.blocked',
  server_denied: 'content.access.states.serverDenied',
} as const;

const contentAccessVariantByState = {
  editable: 'default',
  read_only: 'secondary',
  blocked: 'destructive',
  server_denied: 'destructive',
} as const;

const contentAccessReasonKeyByValue = {
  content_read_missing: 'content.access.reasons.contentReadMissing',
  content_update_missing: 'content.access.reasons.contentUpdateMissing',
  context_restricted: 'content.access.reasons.contextRestricted',
  server_forbidden: 'content.access.reasons.serverForbidden',
} as const;

const formatAccessContext = (access: IamContentAccessSummary) => {
  if (access.organizationIds.length > 0) {
    return t('content.access.context.organizationIds', { value: access.organizationIds.join(', ') });
  }
  if (access.sourceKinds.length > 0) {
    return t('content.access.context.sourceKinds', { value: access.sourceKinds.join(', ') });
  }
  return t('content.access.context.none');
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
  const contentAccessApi = useContentAccess();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const normalizedSearch = search.trim().toLowerCase();
  const createDisabled =
    contentAccessApi.access ? !contentAccessApi.access.canCreate : contentsApi.error?.code === 'forbidden';

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

  const contentColumns = React.useMemo<readonly StudioColumnDef<(typeof filteredContents)[number]>[]>(
    () => [
      {
        id: 'title',
        header: t('content.table.headerTitle'),
        cell: (item) => <span className="font-medium text-foreground">{item.title}</span>,
        sortable: true,
        sortValue: (item) => item.title.toLowerCase(),
      },
      {
        id: 'contentType',
        header: t('content.table.headerType'),
        cell: (item) => item.contentType,
        sortable: true,
        sortValue: (item) => item.contentType.toLowerCase(),
      },
      {
        id: 'publishedAt',
        header: t('content.table.headerPublished'),
        cell: (item) => formatDateTime(item.publishedAt),
        sortable: true,
        sortValue: (item) => item.publishedAt ?? '',
      },
      {
        id: 'createdAt',
        header: t('content.table.headerCreated'),
        cell: (item) => formatDateTime(item.createdAt),
        sortable: true,
        sortValue: (item) => item.createdAt,
      },
      {
        id: 'updatedAt',
        header: t('content.table.headerUpdated'),
        cell: (item) => formatDateTime(item.updatedAt),
        sortable: true,
        sortValue: (item) => item.updatedAt,
      },
      {
        id: 'author',
        header: t('content.table.headerAuthor'),
        cell: (item) => item.author,
        sortable: true,
        sortValue: (item) => item.author.toLowerCase(),
      },
      {
        id: 'payload',
        header: t('content.table.headerPayload'),
        cell: (item) => <span className="max-w-sm text-foreground">{summarizePayload(item.payload)}</span>,
      },
      {
        id: 'status',
        header: t('content.table.headerStatus'),
        cell: (item) => <Badge variant={statusVariantByValue[item.status]}>{t(statusLabelKeyByValue[item.status])}</Badge>,
        sortable: true,
        sortValue: (item) => item.status,
      },
      {
        id: 'access',
        header: t('content.table.headerAccess'),
        cell: (item) => {
          const access = resolveRowAccess(item.access, contentsApi.error);
          return (
            <div>
              <Badge variant={contentAccessVariantByState[access.state]}>
                {t(contentAccessLabelKeyByState[access.state])}
              </Badge>
              {access.reasonCode ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(contentAccessReasonKeyByValue[access.reasonCode])}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'context',
        header: t('content.table.headerContext'),
        cell: (item) => formatAccessContext(resolveRowAccess(item.access, contentsApi.error)),
      },
    ],
    [contentsApi.error, filteredContents]
  );

  return (
    <section className="space-y-5" aria-busy={contentsApi.isLoading}>
      <StudioListPageTemplate
        title={t('content.page.title')}
        description={t('content.page.subtitle')}
        primaryAction={{
          label: t('content.actions.create'),
          render: createDisabled ? (
            <Button type="button" disabled>
              {t('content.actions.create')}
            </Button>
          ) : (
            <Button asChild>
              <Link to="/admin/content/new">{t('content.actions.create')}</Link>
            </Button>
          ),
        }}
      >
        {contentAccessApi.access ? (
          <p className="text-sm text-muted-foreground">
            {t('content.messages.accessSummary', {
              state: t(contentAccessLabelKeyByState[contentAccessApi.access.state]),
              context: formatAccessContext(contentAccessApi.access),
            })}
          </p>
        ) : createDisabled ? (
          <p className="text-sm text-muted-foreground">{t('content.messages.actionsDisabled')}</p>
        ) : null}
      </StudioListPageTemplate>

      {contentsApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
          <AlertDescription>{contentErrorMessage(contentsApi.error)}</AlertDescription>
        </Alert>
      ) : null}

      {contentAccessApi.error && !contentsApi.error ? (
        <Alert className="border-secondary/40 bg-secondary/5 text-secondary">
          <AlertDescription>{t('content.messages.accessLoadError')}</AlertDescription>
        </Alert>
      ) : null}

      <StudioDataTable
        ariaLabel={t('content.table.ariaLabel')}
        caption={t('content.table.caption')}
        data={filteredContents}
        columns={contentColumns}
        getRowId={(item) => item.id}
        selectionMode="none"
        isLoading={contentsApi.isLoading || contentAccessApi.isLoading}
        loadingState={t('content.messages.loading')}
        emptyState={
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">{t('content.empty.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('content.empty.body')}</p>
          </div>
        }
        toolbarStart={
          <>
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
          </>
        }
        rowActions={(item) => {
          const access = resolveRowAccess(item.access, contentsApi.error);
          const actionLabel = access.canUpdate
            ? t('content.actions.edit')
            : access.canRead
              ? t('content.actions.openReadOnly')
              : t('content.actions.blocked');

          return access.canRead ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/content/$id" params={{ id: item.id }}>
                {actionLabel}
              </Link>
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled>
              {actionLabel}
            </Button>
          );
        }}
      />
    </section>
  );
};
