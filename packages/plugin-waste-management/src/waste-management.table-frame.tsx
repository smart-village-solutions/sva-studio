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
}: {
  readonly page: number;
  readonly safePage: number;
  readonly onPageChange: (page: number) => void;
}) => {
  useEffect(() => {
    if (page === safePage) {
      return;
    }

    onPageChange(safePage);
  }, [onPageChange, page, safePage]);
};

export const WastePanelTableTopBar = ({ children }: { readonly children?: ReactNode }) => (
  <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 py-4">
    <div className="flex w-full flex-wrap items-center gap-2">{children}</div>
  </div>
);

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
  <div className="-mt-px flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-4 text-sm text-muted-foreground">
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
    <div className="flex items-center gap-4">
      <p aria-live="polite">
        {pt('meta.pagination.rangeLabel', {
          start: totalItems === 0 ? 0 : (page - 1) * pageSize + 1,
          end: Math.min(page * pageSize, totalItems),
          total: totalItems,
        })}
      </p>
      <nav aria-label={pt('meta.pagination.ariaLabel')} className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {pt('meta.pagination.previous')}
        </Button>
        <Button
          type="button"
          variant="outline"
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
