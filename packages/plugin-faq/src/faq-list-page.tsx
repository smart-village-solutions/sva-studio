import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioDataTable, StudioEmptyState, StudioErrorState, StudioLoadingState, StudioOverviewPageTemplate } from '@sva/studio-ui-react';
import React from 'react';

import { listFaqs, type FaqListResult } from './faq.api.js';
import { readFaqPayload } from './faq.model.js';

const toPage = (value: number | undefined) => typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
const toPageSize = (value: number | undefined) => value === 50 || value === 100 ? value : 25;

export const FaqListPage = () => {
  const pt = usePluginTranslation('faq');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { readonly page?: number; readonly pageSize?: number };
  const page = toPage(search.page);
  const pageSize = toPageSize(search.pageSize);
  const [result, setResult] = React.useState<FaqListResult>({ data: [], pagination: { page, pageSize, hasNextPage: false } });
  const [status, setStatus] = React.useState<'loading' | 'error' | 'ready'>('loading');
  const [languageCode, setLanguageCode] = React.useState('');
  const visibleItems = result.data.filter((item) => languageCode.length === 0 || readFaqPayload(item.payload).languageCode === languageCode);

  React.useEffect(() => {
    let active = true;
    setStatus('loading');
    void listFaqs({ page, pageSize }).then(
      (nextResult) => active && (setResult(nextResult), setStatus('ready')),
      () => active && setStatus('error')
    );
    return () => { active = false; };
  }, [page, pageSize]);

  return <StudioOverviewPageTemplate title={pt('list.title')} primaryAction={<Button asChild><Link to="/admin/faq/new">{pt('actions.create')}</Link></Button>}>
    <label className="grid max-w-xs gap-1 text-sm font-medium" htmlFor="faq-language-filter">{pt('fields.languageCode')}<input id="faq-language-filter" className="rounded-md border px-3 py-2" value={languageCode} onChange={(event) => setLanguageCode(event.target.value)} /></label>
    {status === 'loading' ? <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState> : null}
    {status === 'error' ? <StudioErrorState>{pt('messages.loadError')}</StudioErrorState> : null}
    {status === 'ready' && visibleItems.length === 0 ? <StudioEmptyState>{pt('list.empty')}</StudioEmptyState> : null}
    {status === 'ready' && visibleItems.length > 0 ? <div className="space-y-4"><StudioDataTable ariaLabel={pt('list.title')} data={visibleItems} columns={[
      { id: 'question', header: pt('fields.question'), cell: (item) => item.title },
      { id: 'languageCode', header: pt('fields.languageCode'), cell: (item) => readFaqPayload(item.payload).languageCode },
      { id: 'sortWeight', header: pt('fields.sortWeight'), cell: (item) => readFaqPayload(item.payload).sortWeight },
    ]} rowActions={(item) => <Button asChild size="sm" variant="outline"><Link to="/admin/faq/$id" params={{ id: item.id }}>{pt('actions.edit')}</Link></Button>} getRowId={(item) => item.id} selectionMode="none" emptyState={null} labels={{ selectionColumn: pt('fields.question'), actionsColumn: pt('fields.question'), loading: pt('messages.loading'), selectAllRows: (label) => label, selectRow: ({ label }) => label }} />
      <nav aria-label={pt('pagination.ariaLabel')} className="flex items-center justify-between gap-3 text-sm text-muted-foreground"><p aria-live="polite">{pt('pagination.pageLabel', { page: result.pagination.page })}</p><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={result.pagination.page <= 1} onClick={() => void navigate({ to: '/admin/faq', search: (current: Record<string, unknown>) => ({ ...current, page: Math.max(1, result.pagination.page - 1), pageSize: result.pagination.pageSize }) })}>{pt('pagination.previous')}</Button><Button type="button" size="sm" variant="outline" disabled={!result.pagination.hasNextPage} onClick={() => void navigate({ to: '/admin/faq', search: (current: Record<string, unknown>) => ({ ...current, page: result.pagination.page + 1, pageSize: result.pagination.pageSize }) })}>{pt('pagination.next')}</Button></div></nav>
    </div> : null}
  </StudioOverviewPageTemplate>;
};
