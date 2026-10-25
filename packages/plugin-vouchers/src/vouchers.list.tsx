import { Link } from '@tanstack/react-router';
import {
  Button,
  Input,
  Select,
  StudioDataTable,
  StudioErrorState,
  StudioField,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioPagination,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { VoucherUsageView } from './vouchers.usage-view.js';
import { useVoucherList, type VoucherListState } from './vouchers.list-data.js';
function VoucherSearch({
  s,
}: Readonly<{
  s: VoucherListState;
}>) {
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        s.setPage(1);
        s.setQuery((old) => ({ ...old, search: s.search }));
      }}
    >
      <StudioField id="voucher-search" label={s.t('fields.search')}>
        <Input
          id="voucher-search"
          value={s.search}
          onChange={(event) => s.setSearch(event.target.value)}
        />
      </StudioField>
      <Button type="submit" variant="secondary">
        {s.t('fields.search')}
      </Button>
    </form>
  );
}
function VoucherFilters({
  s,
}: Readonly<{
  s: VoucherListState;
}>) {
  return (
    <>
      <VoucherSearch s={s} />
      <StudioField id="voucher-poi-filter" label={s.t('fields.location')}>
        <Select
          id="voucher-poi-filter"
          value={s.query.poiId}
          onChange={(event) => s.filter('poiId', event.target.value)}
        >
          <option value="">{s.t('values.choose')}</option>
          {s.locations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </StudioField>
      <StudioField id="voucher-category-filter" label={s.t('fields.categories')}>
        <Select
          id="voucher-category-filter"
          value={s.query.categoryId}
          onChange={(event) => s.filter('categoryId', event.target.value)}
        >
          <option value="">{s.t('values.choose')}</option>
          {s.categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </StudioField>
      <StudioField id="voucher-visibility-filter" label={s.t('fields.visible')}>
        <Select
          id="voucher-visibility-filter"
          value={s.query.visible}
          onChange={(event) => s.filter('visible', event.target.value)}
        >
          <option value="">{s.t('values.choose')}</option>
          <option value="true">{s.t('values.visible')}</option>
          <option value="false">{s.t('values.hidden')}</option>
        </Select>
      </StudioField>
      <Button
        variant="secondary"
        onClick={() => s.setRevision((value) => value + 1)}
        disabled={s.state === 'loading'}
      >
        {s.t('actions.refresh')}
      </Button>
    </>
  );
}
function VoucherTable({
  s,
}: Readonly<{
  s: VoucherListState;
}>) {
  const result = s.result;
  if (!result) return null;
  return (
    <StudioDataTable
      ariaLabel={s.t('list.title')}
      data={result.data}
      getRowId={(item) => item.id}
      selectionMode="none"
      sorting={{ mode: 'disabled' }}
      emptyState={<p>{s.t('list.empty')}</p>}
      columns={[
        { id: 'title', header: s.t('fields.title'), cell: (item) => item.title },
        {
          id: 'location',
          header: s.t('fields.location'),
          cell: (item) =>
            item.pointOfInterest ? (
              <Link
                className="underline"
                to="/admin/poi/$id"
                params={{ id: item.pointOfInterest.id }}
              >
                {item.pointOfInterest.name}
              </Link>
            ) : (
              ''
            ),
        },
        {
          id: 'usage',
          header: s.t('usage.title'),
          cell: (item) => <VoucherUsageView quota={item.quota} compact />,
        },
        {
          id: 'validity',
          header: s.t('sections.dates'),
          cell: (item) =>
            [item.dates[0]?.dateStart, item.dates[0]?.dateEnd].filter(Boolean).join(' – '),
        },
        {
          id: 'visibility',
          header: s.t('fields.visible'),
          cell: (item) => s.t(item.visible ? 'values.visible' : 'values.hidden'),
        },
      ]}
      rowActions={(item) => (
        <Button variant="secondary" asChild>
          <Link to="/admin/vouchers/$id" params={{ id: item.id }}>
            {s.t('actions.edit')}
          </Link>
        </Button>
      )}
      labels={{
        selectionColumn: s.t('fields.title'),
        actionsColumn: s.t('fields.actions'),
        loading: s.t('messages.loading'),
        selectAllRows: (label) => label,
        selectRow: ({ label }) => label,
      }}
    />
  );
}
function VoucherPaging({
  s,
}: Readonly<{
  s: VoucherListState;
}>) {
  const result = s.result;
  if (!result) return null;
  return (
    <div className="space-y-4">
      <StudioPagination
        page={s.page}
        hasNextPage={result.pagination.hasNextPage}
        ariaLabel={s.t('list.title')}
        pageLabel={String(s.page)}
        previousLabel={s.t('actions.previous')}
        nextLabel={s.t('actions.next')}
        onPageChange={s.setPage}
      />
      <p className="text-xs text-muted-foreground">
        {s.t('usage.fetched', { date: new Date(result.fetchedAt).toLocaleString() })}
      </p>
    </div>
  );
}
export function VouchersListPage({
  principalControl,
}: Readonly<{
  principalControl?: MainserverPrincipalControlModel;
}> = {}) {
  const s = useVoucherList(principalControl);
  return (
    <StudioOverviewPageTemplate
      title={s.t('list.title')}
      description={s.t('list.description')}
      primaryAction={
        s.access.canCreate ? (
          <Button asChild>
            <Link to="/admin/vouchers/new">{s.t('actions.create')}</Link>
          </Button>
        ) : undefined
      }
      toolbar={<VoucherFilters s={s} />}
    >
      {s.state === 'loading' && <StudioLoadingState>{s.t('messages.loading')}</StudioLoadingState>}
      {s.state === 'error' && <StudioErrorState>{s.t('messages.error')}</StudioErrorState>}
      {s.state !== 'loading' && (
        <>
          <VoucherTable s={s} />
          <VoucherPaging s={s} />
        </>
      )}
    </StudioOverviewPageTemplate>
  );
}
