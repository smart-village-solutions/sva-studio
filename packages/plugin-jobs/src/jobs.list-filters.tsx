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
  const pt = usePluginTranslation('jobs');
  return (
    <>
      <MainserverPrincipalControl
        id="job-list-principal"
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
        <StudioField id="job-search" label={pt('fields.search')}>
          <Input
            id="job-search"
            type="search"
            value={filters.search}
            onChange={(event) => filter('search', event.currentTarget.value)}
          />
        </StudioField>
        <StudioField id="job-employment-filter" label={pt('fields.employmentType')}>
          <Select
            id="job-employment-filter"
            value={filters.employmentType}
            onChange={(event) => filter('employmentType', event.currentTarget.value)}
          >
            <option value="">{pt('fields.allEmploymentTypes')}</option>
            {filters.employmentType &&
            !categories.some((item) => item.name === filters.employmentType) ? (
              <option value={filters.employmentType}>{filters.employmentType}</option>
            ) : null}
            {categories.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </Select>
        </StudioField>
        <StudioField id="job-visible-filter" label={pt('fields.visible')}>
          <Select
            id="job-visible-filter"
            value={filters.visible}
            onChange={(event) => filter('visible', event.currentTarget.value)}
          >
            <option value="">{pt('fields.allVisibility')}</option>
            <option value="true">{pt('fields.visibleYes')}</option>
            <option value="false">{pt('fields.visibleNo')}</option>
          </Select>
        </StudioField>
        <StudioField id="job-temporal-filter" label={pt('fields.state')}>
          <Select
            id="job-temporal-filter"
            value={filters.temporal}
            onChange={(event) => filter('temporal', event.currentTarget.value)}
          >
            <option value="">{pt('fields.allTemporal')}</option>
            {(['planned', 'ongoing', 'ended', 'incomplete'] as const).map((state) => (
              <option key={state} value={state}>
                {pt(`temporal.${state}`)}
              </option>
            ))}
          </Select>
        </StudioField>
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
    ['search', 'employmentType', 'visible', 'temporal'].map((key) => [
      key,
      typeof search[key] === 'string' ? (search[key] as string) : '',
    ])
  );
  const filter = (key: string, value: string) =>
    void navigate({
      to: '/admin/content',
      search: (current: Record<string, unknown>) => ({
        ...current,
        type: 'jobs.job',
        q: key === 'search' ? value || undefined : current.search,
        ...(key === 'search' ? {} : { [key]: value || undefined }),
        page: 1,
        pageSize,
      }),
      replace: true,
    });
  return { filters, filter };
}
