import { useNavigate } from '@tanstack/react-router';
import { usePluginTranslation, type MainserverActingPrincipalType } from '@sva/plugin-sdk';
import {
  Input,
  Select,
  StudioField,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';

export function ListFilters({
  filters,
  categories,
  filter,
  principalControl,
  principal,
  onPrincipalChange,
}: Readonly<{
  principalControl?: MainserverPrincipalControlModel;
  principal: MainserverActingPrincipalType;
  onPrincipalChange: (principal: MainserverActingPrincipalType) => void;
  filters: Record<string, string>;
  categories: readonly { id: string; name: string }[];
  filter: (key: string, value: string) => void;
}>) {
  const pt = usePluginTranslation('construction-sites');
  return (
    <>
      <MainserverPrincipalControl
        id="cs-list-principal"
        label={pt('principal.actAs')}
        value={principal}
        onChange={onPrincipalChange}
        options={resolveMainserverPrincipalOptions(principalControl, {
          value: principal,
          label: pt(`principal.${principal}`),
        })}
        contextOptions={principalControl?.contextOptions}
        onContextChange={principalControl?.onContextChange}
        readinessByPrincipal={principalControl?.readinessByPrincipal}
        readinessMessage={principalControl?.readinessMessage}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StudioField id="cs-search" label={pt('fields.search')}>
          <Input
            id="cs-search"
            type="search"
            value={filters.search}
            onChange={(event) => filter('search', event.currentTarget.value)}
          />
        </StudioField>
        <StudioField id="cs-category" label={pt('fields.categories')}>
          <Select
            id="cs-category"
            value={filters.category}
            onChange={(event) => filter('category', event.currentTarget.value)}
          >
            <option value="">{pt('fields.allCategories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </Select>
        </StudioField>
        {(['dateStart', 'dateEnd'] as const).map((key) => (
          <StudioField key={key} id={`cs-filter-${key}`} label={pt(`fields.${key}`)}>
            <Input
              id={`cs-filter-${key}`}
              type="date"
              value={filters[key]}
              onChange={(event) => filter(key, event.currentTarget.value)}
            />
          </StudioField>
        ))}
      </div>
    </>
  );
}
export function listFilters(
  search: Record<string, unknown>,
  navigate: ReturnType<typeof useNavigate>,
  pageSize: number
) {
  const filters = Object.fromEntries(
    ['search', 'category', 'dateStart', 'dateEnd'].map((key) => [
      key,
      typeof search[key] === 'string' ? (search[key] as string) : '',
    ])
  );
  const filter = (key: string, value: string) =>
    void navigate({
      to: '/admin/content',
      search: (current: Record<string, unknown>) => ({
        ...current,
        type: 'construction-sites.construction-site',
        q: key === 'search' ? value || undefined : current.search,
        ...(key === 'search' ? {} : { [key]: value || undefined }),
        page: 1,
        pageSize,
      }),
      replace: true,
    });
  return { filters, filter };
}
