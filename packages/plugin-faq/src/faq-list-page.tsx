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
type Translator = ReturnType<typeof usePluginTranslation>;
type FaqListStatus = 'loading' | 'error' | 'ready';
type FaqListSearch = Readonly<{ page?: number; pageSize?: number; languageCode?: string }>;

const FaqLanguageFilter = ({
  languageCode,
  onChange,
  pt,
}: Readonly<{ languageCode: string; onChange: (value: string) => void; pt: Translator }>) => (
  <StudioField id="faq-language-filter" label={pt('fields.languageCode')}>
    <Input
      id="faq-language-filter"
      className="w-full sm:w-64"
      value={languageCode}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  </StudioField>
);

const FaqTable = ({ pt, result }: Readonly<{ pt: Translator; result: FaqListResult }>) => (
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
);

const FaqListContent = ({
  onPageChange,
  pt,
  result,
  status,
}: Readonly<{
  onPageChange: (page: number) => void;
  pt: Translator;
  result: FaqListResult;
  status: FaqListStatus;
}>) => {
  if (status === 'loading') return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (status === 'error') return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;
  if (result.data.length === 0) return <StudioEmptyState>{pt('list.empty')}</StudioEmptyState>;
  return (
    <div className="space-y-4">
      <FaqTable pt={pt} result={result} />
      <StudioPagination
        page={result.pagination.page}
        hasNextPage={result.pagination.hasNextPage}
        ariaLabel={pt('pagination.ariaLabel')}
        pageLabel={pt('pagination.pageLabel', { page: result.pagination.page })}
        previousLabel={pt('pagination.previous')}
        nextLabel={pt('pagination.next')}
        onPageChange={onPageChange}
      />
    </div>
  );
};

const useFaqList = (query: Readonly<{ page: number; pageSize: number; languageCode?: string }>) => {
  const [result, setResult] = React.useState<FaqListResult>({
    data: [],
    pagination: { page: query.page, pageSize: query.pageSize, hasNextPage: false },
  });
  const [status, setStatus] = React.useState<FaqListStatus>('loading');
  React.useEffect(() => {
    let active = true;
    setStatus('loading');
    void listFaqs(query).then(
      (nextResult) => active && (setResult(nextResult), setStatus('ready')),
      () => active && setStatus('error')
    );
    return () => {
      active = false;
    };
  }, [query.languageCode, query.page, query.pageSize]);
  return { result, status };
};

export const FaqListPage = () => {
  const pt = usePluginTranslation('faq');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as FaqListSearch;
  const page = toPage(search.page);
  const pageSize = toPageSize(search.pageSize);
  const languageCode = normalizeLanguageFilter(search.languageCode);
  const { result, status } = useFaqList({ page, pageSize, languageCode });

  React.useEffect(() => {
    if (search.page === page && search.pageSize === pageSize && search.languageCode === languageCode)
      return;
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
        <FaqLanguageFilter
          languageCode={search.languageCode ?? ''}
          pt={pt}
          onChange={(value) =>
            void navigate({
              to: '/admin/faq',
              search: (current: Record<string, unknown>) => ({
                ...current,
                page: 1,
                pageSize,
                languageCode: normalizeLanguageFilter(value),
              }),
            })
          }
        />
      }
    >
      <FaqListContent result={result} status={status} onPageChange={navigateToPage} pt={pt} />
    </StudioOverviewPageTemplate>
  );
};
