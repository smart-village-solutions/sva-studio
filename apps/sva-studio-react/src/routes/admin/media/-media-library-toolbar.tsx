import { StudioFilterSurface } from '../../../components/StudioFilterSurface';
import { t } from '../../../i18n';

type MediaLibraryToolbarProps = Readonly<{
  page: number;
  pageSize: number;
  total: number;
}>;

export const MediaLibraryToolbar = ({ page, pageSize, total }: MediaLibraryToolbarProps) => (
  <StudioFilterSurface className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{t('media.library.toolbar.title')}</p>
      <p className="text-sm text-muted-foreground">{t('media.library.toolbar.summary', { count: total })}</p>
    </div>
    <div className="text-sm text-muted-foreground">
      {t('media.library.toolbar.page', {
        page,
        pageSize,
      })}
    </div>
  </StudioFilterSurface>
);
