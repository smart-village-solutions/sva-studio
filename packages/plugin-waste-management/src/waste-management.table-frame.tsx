import { usePluginTranslation } from '@sva/plugin-sdk';
import { useEffect, type ReactNode } from 'react';
import { Button, Select } from '@sva/studio-ui-react';

export const createPagedItems = <TItem,>({
  items,
  page,
  pageSize,
}: {
  readonly items: readonly TItem[];
  readonly page: number;
  readonly pageSize: number;
}) => {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const startIndex = (safePage - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    pageCount,
    safePage,
    totalItems: items.length,
  } as const;
};

export const usePagedRouteSync = ({
  page,
  safePage,
  onPageChange,
  onSyncPageChange,
}: {
  readonly page: number;
  readonly safePage: number;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
}) => {
  useEffect(() => {
    if (page === safePage) {
      return;
    }

    (onSyncPageChange ?? onPageChange)(safePage);
  }, [onPageChange, onSyncPageChange, page, safePage]);
};

export type WastePanelTableTopBarProps = {
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly activeFilters?: ReactNode;
  readonly selection?: ReactNode;
};

export const WastePanelTableTopBar = ({
  children,
  actions,
  activeFilters,
  selection,
}: WastePanelTableTopBarProps) => (
  <div className="space-y-3 border-b border-border bg-card px-4 py-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      {children ? (
        <div className="flex min-w-0 grow basis-64 flex-wrap items-end gap-2">{children}</div>
      ) : null}
      {actions ? (
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
    {activeFilters ? (
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground empty:hidden">
        {activeFilters}
      </div>
    ) : null}
    {selection ? (
      <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
        {selection}
      </div>
    ) : null}
  </div>
);

export const WasteCompactListSort = <TField extends string>({
  fields,
  field,
  direction,
  labelForField,
  onChange,
}: {
  readonly fields: readonly TField[];
  readonly field: TField | null;
  readonly direction: 'asc' | 'desc';
  readonly labelForField: (field: TField) => string;
  readonly onChange: (field: TField, direction: 'asc' | 'desc') => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-border px-4 py-3 text-sm lg:hidden">
      <label className="grid min-w-0 gap-1">
        {pt('filters.sortField')}
        <Select
          value={field ?? ''}
          onChange={(event) => {
            const selected = fields.find((item) => item === event.currentTarget.value);
            if (selected) onChange(selected, direction);
          }}
        >
          {field === null ? (
            <option value="" disabled>
              {pt('filters.defaultSort')}
            </option>
          ) : null}
          {fields.map((item) => (
            <option key={item} value={item}>
              {labelForField(item)}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid min-w-0 gap-1">
        {pt('filters.sortDirection')}
        <Select
          value={direction}
          disabled={field === null}
          onChange={(event) => {
            if (field !== null)
              onChange(field, event.currentTarget.value === 'desc' ? 'desc' : 'asc');
          }}
        >
          <option value="asc">{pt('masterData.locationsWorkspace.sorting.ascending')}</option>
          <option value="desc">{pt('masterData.locationsWorkspace.sorting.descending')}</option>
        </Select>
      </label>
    </div>
  );
};

export const WastePanelTableBottomBar = ({
  pt,
  page,
  pageSize,
  pageCount,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  readonly pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly totalItems: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
}) => (
  <div className="-mt-px flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-4 text-sm text-muted-foreground">
    <div className="flex items-center gap-2">
      <span>{pt('meta.pagination.pageSizeLabel')}</span>
      <Select
        aria-label={pt('meta.pagination.pageSizeLabel')}
        className="h-9 w-auto min-w-24"
        value={String(pageSize)}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
      >
        <option value="10">10</option>
        <option value="25">25</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </Select>
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <p aria-live="polite">
        {pt('meta.pagination.rangeLabel', {
          start: totalItems === 0 ? 0 : (page - 1) * pageSize + 1,
          end: Math.min(page * pageSize, totalItems),
          total: totalItems,
        })}
      </p>
      <nav aria-label={pt('meta.pagination.ariaLabel')} className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {pt('meta.pagination.previous')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          {pt('meta.pagination.next')}
        </Button>
      </nav>
    </div>
  </div>
);
