import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Input,
  StudioDataTable,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioPagination,
} from '@sva/studio-ui-react';
import React from 'react';

import { listFaqs, type FaqListResult } from './faq.api.js';
import { readFaqPayload } from './faq.model.js';

const toPage = (value: number | undefined) =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
const toPageSize = (value: number | undefined) => (value === 50 || value === 100 ? value : 25);
const normalizeLanguageFilter = (value: string | undefined) =>
  value?.trim().toLowerCase() || undefined;

export const FaqListPage = () => {
  const pt = usePluginTranslation('faq');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    readonly page?: number;
    readonly pageSize?: number;
    readonly languageCode?: string;
  };
  const page = toPage(search.page);
  const pageSize = toPageSize(search.pageSize);
  const languageCode = normalizeLanguageFilter(search.languageCode);
  const [result, setResult] = React.useState<FaqListResult>({
    data: [],
    pagination: { page, pageSize, hasNextPage: false },
  });
  const [status, setStatus] = React.useState<'loading' | 'error' | 'ready'>('loading');

  React.useEffect(() => {
    if (
      search.page === page &&
      search.pageSize === pageSize &&
      search.languageCode === languageCode
    ) {
      return;
    }
    void navigate({
      to: '/admin/faq',
      replace: true,
      search: (current: Record<string, unknown>) => ({
        ...current,
        page,
        pageSize,
        languageCode,
      }),
    });
  }, [languageCode, navigate, page, pageSize, search.languageCode, search.page, search.pageSize]);

  React.useEffect(() => {
    let active = true;
    setStatus('loading');
    void listFaqs({ page, pageSize, languageCode }).then(
      (nextResult) => {
        if (active) {
          setResult(nextResult);
          setStatus('ready');
        }
      },
      () => active && setStatus('error')
    );
    return () => {
      active = false;
    };
  }, [languageCode, page, pageSize]);

  const navigateToPage = (nextPage: number) =>
    void navigate({
      to: '/admin/faq',
      search: (current: Record<string, unknown>) => ({
        ...current,
        page: nextPage,
        pageSize: result.pagination.pageSize,
        languageCode,
      }),
    });

  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        <Button asChild>
          <Link to="/admin/faq/new">{pt('actions.create')}</Link>
        </Button>
      }
      toolbar={
        <StudioField id="faq-language-filter" label={pt('fields.languageCode')}>
          <Input
            id="faq-language-filter"
            className="w-full sm:w-64"
            value={search.languageCode ?? ''}
            onChange={(event) => {
              const nextLanguageCode = normalizeLanguageFilter(event.currentTarget.value);
              void navigate({
                to: '/admin/faq',
                search: (current: Record<string, unknown>) => ({
                  ...current,
                  page: 1,
                  pageSize,
                  languageCode: nextLanguageCode,
                }),
              });
            }}
          />
        </StudioField>
      }
    >
      {status === 'loading' ? (
        <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
      ) : null}
      {status === 'error' ? <StudioErrorState>{pt('messages.loadError')}</StudioErrorState> : null}
      {status === 'ready' && result.data.length === 0 ? (
        <StudioEmptyState>{pt('list.empty')}</StudioEmptyState>
      ) : null}
      {status === 'ready' && result.data.length > 0 ? (
        <div className="space-y-4">
          <StudioDataTable
            ariaLabel={pt('list.title')}
            data={result.data}
            columns={[
              { id: 'question', header: pt('fields.question'), cell: (item) => item.title },
              {
                id: 'languageCode',
                header: pt('fields.languageCode'),
                cell: (item) => readFaqPayload(item.payload).languageCode,
              },
              {
                id: 'sortWeight',
                header: pt('fields.sortWeight'),
                cell: (item) => readFaqPayload(item.payload).sortWeight,
              },
            ]}
            rowActions={(item) => (
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/faq/$id" params={{ id: item.id }}>
                  {pt('actions.edit')}
                </Link>
              </Button>
            )}
            getRowId={(item) => item.id}
            selectionMode="none"
            emptyState={null}
            labels={{
              selectionColumn: pt('fields.question'),
              actionsColumn: pt('fields.actions'),
              loading: pt('messages.loading'),
              selectAllRows: (label) => label,
              selectRow: ({ label }) => label,
            }}
          />
          <StudioPagination
            page={result.pagination.page}
            hasNextPage={result.pagination.hasNextPage}
            ariaLabel={pt('pagination.ariaLabel')}
            pageLabel={pt('pagination.pageLabel', { page: result.pagination.page })}
            previousLabel={pt('pagination.previous')}
            nextLabel={pt('pagination.next')}
            onPageChange={navigateToPage}
          />
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
};
