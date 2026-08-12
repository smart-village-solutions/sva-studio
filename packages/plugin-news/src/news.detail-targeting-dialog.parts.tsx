import { Button, Checkbox, Input, Select } from '@sva/studio-ui-react';

import type { NewsTargetingTranslator } from './news.detail-targeting-tab.js';
import type { NewsWasteTargetOption } from './news.waste-targeting.js';
import type { WasteLocationKey } from './news.types.js';
import type {
  WasteCityRecord,
  WasteHouseNumberRecord,
  WasteManagementMasterDataOverview,
  WasteStreetRecord,
} from '@sva/plugin-sdk';

type TargetingFiltersProps = Readonly<{
  overview: WasteManagementMasterDataOverview;
  pt: NewsTargetingTranslator;
  filters: Readonly<{
    query: string;
    regionId: string;
    cityId: string;
    streetId: string;
    houseNumberId: string;
  }>;
  cities: readonly WasteCityRecord[];
  streets: readonly WasteStreetRecord[];
  houseNumbers: readonly WasteHouseNumberRecord[];
  cityContextLabel: (cityId: string) => string;
  streetContextLabel: (streetId: string) => string;
  updateFilters: (next: Partial<TargetingFiltersProps['filters']>) => void;
}>;

export function TargetingFilters({
  overview,
  pt,
  filters,
  cities,
  streets,
  houseNumbers,
  cityContextLabel,
  streetContextLabel,
  updateFilters,
}: TargetingFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      <label className="grid gap-1 text-sm font-medium" htmlFor="news-targeting-search">
        {pt('targeting.filters.search')}
        <Input
          id="news-targeting-search"
          value={filters.query}
          onChange={(event) => updateFilters({ query: event.target.value })}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium" htmlFor="news-targeting-region">
        {pt('targeting.filters.region')}
        <Select
          id="news-targeting-region"
          value={filters.regionId}
          onChange={(event) =>
            updateFilters({
              regionId: event.target.value,
              cityId: '',
              streetId: '',
              houseNumberId: '',
            })
          }
        >
          <option value="">{pt('targeting.filters.allRegions')}</option>
          {overview.regions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1 text-sm font-medium" htmlFor="news-targeting-city">
        {pt('targeting.filters.city')}
        <Select
          id="news-targeting-city"
          value={filters.cityId}
          onChange={(event) =>
            updateFilters({ cityId: event.target.value, streetId: '', houseNumberId: '' })
          }
        >
          <option value="">{pt('targeting.filters.allCities')}</option>
          {cities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1 text-sm font-medium" htmlFor="news-targeting-street">
        {pt('targeting.filters.street')}
        <Select
          id="news-targeting-street"
          value={filters.streetId}
          onChange={(event) => updateFilters({ streetId: event.target.value, houseNumberId: '' })}
        >
          <option value="">{pt('targeting.filters.allStreets')}</option>
          {streets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {cityContextLabel(item.cityId)}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1 text-sm font-medium" htmlFor="news-targeting-house-number">
        {pt('targeting.filters.houseNumber')}
        <Select
          id="news-targeting-house-number"
          value={filters.houseNumberId}
          disabled={!filters.streetId}
          onChange={(event) => updateFilters({ houseNumberId: event.target.value })}
        >
          <option value="">{pt('targeting.filters.allHouseNumbers')}</option>
          {houseNumbers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.number} — {streetContextLabel(item.streetId)}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

export function TargetingTable({
  options,
  selectedIds,
  allFilteredSelected,
  pt,
  onToggleOption,
  onToggleAll,
}: Readonly<{
  options: readonly NewsWasteTargetOption[];
  selectedIds: ReadonlySet<string>;
  allFilteredSelected: boolean;
  pt: NewsTargetingTranslator;
  onToggleOption: (key: WasteLocationKey, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
}>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="min-w-full border-collapse" aria-label={pt('targeting.table.label')}>
        <thead>
          <tr className="border-b">
            <th className="p-3 text-left">
              <Checkbox
                aria-label={pt('targeting.actions.selectAll')}
                checked={allFilteredSelected}
                onChange={(event) => onToggleAll(event.target.checked)}
              />
            </th>
            <th className="p-3 text-left">{pt('targeting.table.region')}</th>
            <th className="p-3 text-left">{pt('targeting.table.city')}</th>
            <th className="p-3 text-left">{pt('targeting.table.street')}</th>
            <th className="p-3 text-left">{pt('targeting.table.houseNumber')}</th>
            <th className="p-3 text-left">{pt('targeting.table.designation')}</th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr key={option.id} className="border-b last:border-0">
              <td className="p-3">
                <Checkbox
                  aria-label={option.label}
                  checked={selectedIds.has(option.id)}
                  onChange={(event) => onToggleOption(option.key, event.target.checked)}
                />
              </td>
              <td className="p-3">{option.region || pt('targeting.table.emptyValue')}</td>
              <td className="p-3">
                {option.postalCode} {option.city}
              </td>
              <td className="p-3">{option.street}</td>
              <td className="p-3">{option.houseNumber || pt('targeting.table.emptyValue')}</td>
              <td className="p-3">{option.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {options.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {pt('targeting.table.empty')}
        </p>
      ) : null}
    </div>
  );
}

export function TargetingPagination({
  resultCount,
  page,
  pageCount,
  pt,
  setPage,
}: Readonly<{
  resultCount: number;
  page: number;
  pageCount: number;
  pt: NewsTargetingTranslator;
  setPage: (update: (page: number) => number) => void;
}>) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {pt('targeting.table.status', { count: resultCount, page, pageCount })}
      </span>
      <span>{pt('targeting.table.resultCount', { count: resultCount })}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          {pt('targeting.actions.previous')}
        </Button>
        <span>
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={page >= pageCount}
          onClick={() => setPage((value) => value + 1)}
        >
          {pt('targeting.actions.next')}
        </Button>
      </div>
    </div>
  );
}
