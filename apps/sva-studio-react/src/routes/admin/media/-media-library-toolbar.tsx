import { Button } from '@sva/studio-ui-react';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { StudioFilterSurface } from '../../../components/StudioFilterSurface';
import { t } from '../../../i18n';

type MediaLibraryToolbarProps = Readonly<{
  page: number;
  limit: number;
  itemCount: number;
  canGoBack: boolean;
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onLimitChange: (limit: number) => void;
}>;

export const MediaLibraryToolbar = ({
  page,
  limit,
  itemCount,
  canGoBack,
  canGoForward,
  onPrevious,
  onNext,
  onLimitChange,
}: MediaLibraryToolbarProps) => (
  <StudioFilterSurface className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{t('media.library.toolbar.title')}</p>
      <p className="text-sm text-muted-foreground">
        {t('media.library.toolbar.summary', { count: itemCount })}
      </p>
    </div>
    <div className="flex flex-col gap-3 md:items-end">
      <div className="text-sm text-muted-foreground" aria-live="polite">
        {t('media.library.toolbar.page', {
          page,
          limit,
        })}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="grid gap-1">
          <Label htmlFor="media-library-page-size">
            {t('media.library.toolbar.pageSizeLabel')}
          </Label>
          <Select
            id="media-library-page-size"
            value={String(limit)}
            onChange={(event) => onLimitChange(Number(event.target.value))}
          >
            {[18, 36, 72, 144].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <nav
          aria-label={t('media.library.toolbar.paginationAriaLabel')}
          className="flex items-center gap-2"
        >
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canGoBack}
            onClick={onPrevious}
          >
            {t('media.library.toolbar.previous')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canGoForward}
            onClick={onNext}
          >
            {t('media.library.toolbar.next')}
          </Button>
        </nav>
      </div>
    </div>
  </StudioFilterSurface>
);
