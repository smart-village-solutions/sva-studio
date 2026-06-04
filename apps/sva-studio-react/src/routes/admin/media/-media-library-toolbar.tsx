import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { StudioFilterSurface } from '../../../components/StudioFilterSurface';
import { t } from '../../../i18n';

type MediaLibraryToolbarProps = Readonly<{
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}>;

export const MediaLibraryToolbar = ({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: MediaLibraryToolbarProps) => (
  <StudioFilterSurface className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{t('media.library.toolbar.title')}</p>
      <p className="text-sm text-muted-foreground">{t('media.library.toolbar.summary', { count: total })}</p>
    </div>
    <div className="flex flex-col gap-3 md:items-end">
      <div className="text-sm text-muted-foreground" aria-live="polite">
        {t('media.library.toolbar.page', {
          page,
          total: pageCount,
          pageSize,
        })}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="grid gap-1">
          <Label htmlFor="media-library-page-size">{t('media.library.toolbar.pageSizeLabel')}</Label>
          <Select
            id="media-library-page-size"
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[25, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <nav aria-label={t('media.library.toolbar.paginationAriaLabel')} className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            {t('media.library.toolbar.previous')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            {t('media.library.toolbar.next')}
          </Button>
        </nav>
      </div>
    </div>
  </StudioFilterSurface>
);
