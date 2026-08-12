import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
} from '@sva/studio-ui-react';

import { useNewsTargetingEditor } from './news.detail-targeting-state.js';
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

function TargetingFilters({
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
      <Input
        aria-label={pt('targeting.filters.search')}
        placeholder={pt('targeting.filters.search')}
        value={filters.query}
        onChange={(event) => updateFilters({ query: event.target.value })}
      />
      <Select
        aria-label={pt('targeting.filters.region')}
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
      <Select
        aria-label={pt('targeting.filters.city')}
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
      <Select
        aria-label={pt('targeting.filters.street')}
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
      <Select
        aria-label={pt('targeting.filters.houseNumber')}
        value={filters.houseNumberId}
        onChange={(event) => updateFilters({ houseNumberId: event.target.value })}
      >
        <option value="">{pt('targeting.filters.allHouseNumbers')}</option>
        {houseNumbers.map((item) => (
          <option key={item.id} value={item.id}>
            {item.number} — {streetContextLabel(item.streetId)}
          </option>
        ))}
      </Select>
    </div>
  );
}

type TargetingTableProps = Readonly<{
  options: readonly NewsWasteTargetOption[];
  selectedIds: ReadonlySet<string>;
  allFilteredSelected: boolean;
  pt: NewsTargetingTranslator;
  onToggleOption: (key: WasteLocationKey, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
}>;

function TargetingTable({
  options,
  selectedIds,
  allFilteredSelected,
  pt,
  onToggleOption,
  onToggleAll,
}: TargetingTableProps) {
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

type TargetingPaginationProps = Readonly<{
  resultCount: number;
  page: number;
  pageCount: number;
  pt: NewsTargetingTranslator;
  setPage: (update: (page: number) => number) => void;
}>;

function TargetingPagination({
  resultCount,
  page,
  pageCount,
  pt,
  setPage,
}: TargetingPaginationProps) {
  return (
    <div className="flex items-center justify-between text-sm">
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

type NewsDetailTargetingDialogProps = Readonly<{
  overview: WasteManagementMasterDataOverview;
  options: readonly NewsWasteTargetOption[];
  selected: readonly WasteLocationKey[];
  pt: NewsTargetingTranslator;
  onApply: (selection: readonly WasteLocationKey[]) => void;
}>;

export function NewsDetailTargetingDialog({
  overview,
  options,
  selected,
  pt,
  onApply,
}: NewsDetailTargetingDialogProps) {
  const editor = useNewsTargetingEditor(overview, options, selected);
  const cityContextLabel = (cityId: string) => {
    const city = editor.citiesById.get(cityId);
    return [city?.postalCode, city?.name].filter(Boolean).join(' ');
  };
  const streetContextLabel = (streetId: string) => {
    const street = editor.streetsById.get(streetId);
    return `${street?.name}, ${cityContextLabel(street?.cityId ?? '')}`;
  };
  const applySelection = () => {
    onApply(editor.draft);
    editor.setOpen(false);
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={editor.openEditor}>
        {pt('targeting.actions.edit')}
      </Button>
      <Dialog open={editor.open} onOpenChange={editor.setOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pt('targeting.dialog.title')}</DialogTitle>
            <DialogDescription>{pt('targeting.dialog.description')}</DialogDescription>
          </DialogHeader>
          <TargetingFilters
            overview={overview}
            pt={pt}
            filters={editor.filters}
            cities={editor.filteredCities}
            streets={editor.filteredStreets}
            houseNumbers={editor.filteredHouseNumbers}
            cityContextLabel={cityContextLabel}
            streetContextLabel={streetContextLabel}
            updateFilters={editor.updateFilters}
          />
          <TargetingTable
            options={editor.visible}
            selectedIds={editor.selectedIds}
            allFilteredSelected={editor.allFilteredSelected}
            pt={pt}
            onToggleOption={editor.toggleOption}
            onToggleAll={editor.toggleAllFiltered}
          />
          <TargetingPagination
            resultCount={editor.filtered.length}
            page={editor.page}
            pageCount={editor.pageCount}
            pt={pt}
            setPage={editor.setPage}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => editor.setOpen(false)}>
              {pt('actions.cancel')}
            </Button>
            <Button type="button" onClick={applySelection}>
              {pt('targeting.actions.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
