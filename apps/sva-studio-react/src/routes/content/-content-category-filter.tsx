import type { CategoryListItem } from '@sva/plugin-categories';
import { SearchableMultiSelect } from '@sva/studio-ui-react';
import React from 'react';
import { Label } from '../../components/ui/label';
import { useOrganizationContext } from '../../hooks/use-organization-context';
import { t } from '../../i18n';
import { useAuth } from '../../providers/auth-provider';

export function ContentCategoryFilter({
  value,
  onChange,
}: Readonly<{
  value?: string;
  onChange: (value?: string) => void;
}>) {
  const { id: userId, instanceId } = useAuth().user ?? {};
  const organization = useOrganizationContext().context?.activeOrganizationId;
  const [categories, setCategories] = React.useState<readonly CategoryListItem[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');

  React.useEffect(() => {
    if (!userId) return;
    let active = true;
    setStatus('loading');
    setCategories([]);
    void import('@sva/plugin-categories')
      .then(({ listCategories }) => listCategories())
      .then(
        (items) => {
          if (!active) return;
          setCategories(items);
          setStatus('ready');
        },
        () => {
          if (active) setStatus('error');
        }
      );
    return () => {
      active = false;
    };
  }, [userId, instanceId, organization]);

  const labels = categories.map(({ id, name, parent }) => ({
    value: id,
    label: parent ? `${parent.name} / ${name}` : name,
    keywords: [id],
  }));
  const labelCounts = new Map<string, number>();
  for (const { label } of labels) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  const options = labels.map((option) => ({
    ...option,
    label: (labelCounts.get(option.label) ?? 0) > 1
      ? t('content.batch.categoryWithId', { label: option.label, id: option.value })
      : option.label,
  }));
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="content-category-filter">{t('content.batch.category')}</Label>
      <SearchableMultiSelect
        id="content-category-filter"
        value={value ? [value] : []}
        onValueChange={(values) => onChange(values.at(-1))}
        options={options}
        helpText=""
        loading={status === 'loading'}
        errorMessage={status === 'error' ? t('content.batch.categoryError') : undefined}
        loadingText={t('content.batch.loadingCategories')}
        emptyText={t('content.batch.emptyCategories')}
        placeholder={t('content.batch.allCategories')}
        searchLabel={t('content.batch.category')}
        removeLabel={() => t('content.batch.clearCategory')}
        unavailableText={t('content.batch.categoryError')}
      />
    </div>
  );
}
