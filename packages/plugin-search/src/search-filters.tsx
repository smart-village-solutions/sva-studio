import { Button, SearchableMultiSelect, Select } from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import type { SearchQuery, SearchResults } from './search-contract.js';
type FilterProps = {
  readonly query: SearchQuery;
  readonly options: SearchResults['options'];
  readonly loading: boolean;
  readonly onChange: (query: SearchQuery) => void;
};
const MultiFilter = ({ field: key, ...props }: FilterProps & { field: 'types' | 'categories' }) => {
  const { query, options, loading, onChange } = props;
  const t = usePluginTranslation('search');
  const label = t(key === 'types' ? 'type' : 'category');
  return (
    <div className="min-w-0 space-y-2">
      <label className="text-sm font-medium" htmlFor={`search-${key}`}>
        {label}
      </label>
      <SearchableMultiSelect
        id={`search-${key}`}
        value={query[key]}
        loading={loading}
        disabled={loading}
        options={options[key].map((value) => ({
          value,
          label: key === 'types' ? t(`types.${value.split('.')[0]}`) : value,
        }))}
        onValueChange={(value) => onChange({ ...query, [key]: value, page: 1 })}
        placeholder={t('choose')}
        emptyText={t('noOptions')}
        helpText=""
        loadingText={t('loading')}
        searchLabel={t('filterSearch')}
        unavailableText={t('noOptions')}
        removeLabel={(value) => t('remove', { label: value })}
      />
    </div>
  );
};
export const SearchFilters = ({
  query,
  options,
  loading,
  onChange,
}: {
  readonly query: SearchQuery;
  readonly options: SearchResults['options'];
  readonly loading: boolean;
  readonly onChange: (query: SearchQuery) => void;
}) => {
  const t = usePluginTranslation('search');
  const update = (patch: Partial<SearchQuery>) => onChange({ ...query, ...patch, page: 1 });
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <MultiFilter
          field="types"
          query={query}
          options={options}
          loading={loading}
          onChange={onChange}
        />
        <MultiFilter
          field="categories"
          query={query}
          options={options}
          loading={loading}
          onChange={onChange}
        />
        <div className="space-y-2">
          <label htmlFor="search-provider" className="text-sm font-medium">
            {t('provider')}
          </label>
          <Select
            id="search-provider"
            value={query.provider}
            disabled={loading}
            onChange={(event) => update({ provider: event.target.value })}
          >
            <option value="">{t('allProviders')}</option>
            {options.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {query.types.length > 0 || query.categories.length > 0 || query.provider ? (
        <div className="flex flex-wrap gap-2">
          {query.provider ? (
            <Button variant="secondary" size="sm" onClick={() => update({ provider: '' })}>
              {t('remove', {
                label:
                  options.providers.find((entry) => entry.id === query.provider)?.name ??
                  t('provider'),
              })}
            </Button>
          ) : null}
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => update({ types: [], categories: [], provider: '' })}
          >
            {t('reset')}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
