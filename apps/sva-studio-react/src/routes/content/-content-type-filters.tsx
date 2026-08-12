import type { RegisteredStudioContentType } from '@sva/plugin-sdk';

import { Button } from '@sva/studio-ui-react';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { t } from '../../i18n';
import { resolveStudioContentTypeLabel } from '../../lib/studio-content-types';

const QUICK_FILTER_CONTENT_TYPES = ['news.article', 'events.event-record'] as const;
const QUICK_FILTER_CONTENT_TYPE_SET = new Set<string>(QUICK_FILTER_CONTENT_TYPES);

const getQuickFilterOrder = (contentType: string): number =>
  QUICK_FILTER_CONTENT_TYPES.indexOf(contentType as (typeof QUICK_FILTER_CONTENT_TYPES)[number]);

export const ContentTypeFilters = ({
  contentTypes,
  selectedType,
  onTypeChange,
}: Readonly<{
  contentTypes: readonly RegisteredStudioContentType[];
  selectedType: string;
  onTypeChange: (contentType: string) => void;
}>) => {
  const quickFilterContentTypes = [
    ...contentTypes.filter((definition) =>
      QUICK_FILTER_CONTENT_TYPE_SET.has(definition.contentType)
    ),
  ].sort(
    (left, right) => getQuickFilterOrder(left.contentType) - getQuickFilterOrder(right.contentType)
  );
  const dropdownContentTypes = contentTypes.filter(
    (definition) => !QUICK_FILTER_CONTENT_TYPE_SET.has(definition.contentType)
  );
  const selectedDropdownType = dropdownContentTypes.some(
    (definition) => definition.contentType === selectedType
  )
    ? selectedType
    : '';

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">
          {t('content.filters.quickTypeLabel')}
        </span>
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t('content.filters.quickTypeLabel')}
        >
          <Button
            type="button"
            size="sm"
            variant={selectedType === 'all' ? 'primary' : 'secondary'}
            aria-pressed={selectedType === 'all'}
            onClick={() => onTypeChange('all')}
          >
            {t('content.filters.quickAll')}
          </Button>
          {quickFilterContentTypes.map((definition) => {
            const isSelected = selectedType === definition.contentType;
            return (
              <Button
                key={definition.contentType}
                type="button"
                size="sm"
                variant={isSelected ? 'primary' : 'secondary'}
                aria-pressed={isSelected}
                onClick={() => onTypeChange(definition.contentType)}
              >
                {resolveStudioContentTypeLabel(definition)}
              </Button>
            );
          })}
        </div>
      </div>
      {dropdownContentTypes.length > 0 ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="content-type-filter">{t('content.filters.otherTypeLabel')}</Label>
          <Select
            id="content-type-filter"
            value={selectedDropdownType}
            onChange={(event) => onTypeChange(event.target.value)}
          >
            <option value="" disabled>
              {t('content.filters.otherTypePlaceholder')}
            </option>
            {dropdownContentTypes.map((definition) => (
              <option key={definition.contentType} value={definition.contentType}>
                {resolveStudioContentTypeLabel(definition)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </>
  );
};
