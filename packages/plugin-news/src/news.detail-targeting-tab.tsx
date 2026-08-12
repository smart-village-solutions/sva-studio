import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
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

import {
  findStaleWasteLocationKeys,
  resolveNewsWasteTargetOptions,
  wasteLocationKeyId,
} from './news.waste-targeting.js';
import type { NewsDetailFormValues, WasteLocationKey } from './news.types.js';
import type { WasteManagementMasterDataOverview } from '@sva/plugin-sdk';

type Translator = (key: string, variables?: Readonly<Record<string, string | number>>) => string;
const pageSize = 25;

export function NewsDetailTargetingSection({
  overview,
  pt,
}: Readonly<{ overview: WasteManagementMasterDataOverview; pt: Translator }>) {
  const { control, setValue } = useFormContext<NewsDetailFormValues>();
  const selected = useWatch({ control, name: 'wasteLocationKeys' }) ?? [];
  const options = React.useMemo(() => resolveNewsWasteTargetOptions(overview), [overview]);
  const stale = React.useMemo(
    () => findStaleWasteLocationKeys(selected, options),
    [options, selected]
  );
  const staleIds = React.useMemo(
    () => new Set(stale.map(wasteLocationKeyId)),
    [stale]
  );
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<readonly WasteLocationKey[]>([]);
  const [query, setQuery] = React.useState('');
  const [regionId, setRegionId] = React.useState('');
  const [cityId, setCityId] = React.useState('');
  const [streetId, setStreetId] = React.useState('');
  const [houseNumberId, setHouseNumberId] = React.useState('');
  const [page, setPage] = React.useState(1);
  const citiesById = React.useMemo(
    () => new Map(overview.cities.map((city) => [city.id, city] as const)),
    [overview.cities]
  );
  const streetsById = React.useMemo(
    () => new Map(overview.streets.map((street) => [street.id, street] as const)),
    [overview.streets]
  );
  const filteredCities = React.useMemo(
    () => overview.cities.filter((city) => !regionId || city.regionId === regionId),
    [overview.cities, regionId]
  );
  const filteredStreets = React.useMemo(
    () =>
      overview.streets.filter((street) => {
        const city = citiesById.get(street.cityId);
        return (
          (!regionId || city?.regionId === regionId) && (!cityId || street.cityId === cityId)
        );
      }),
    [citiesById, cityId, overview.streets, regionId]
  );
  const filteredHouseNumbers = React.useMemo(
    () =>
      overview.houseNumbers.filter((houseNumber) => {
        const street = streetsById.get(houseNumber.streetId);
        const city = street ? citiesById.get(street.cityId) : undefined;
        return (
          (!regionId || city?.regionId === regionId) &&
          (!cityId || city?.id === cityId) &&
          (!streetId || houseNumber.streetId === streetId)
        );
      }),
    [citiesById, cityId, overview.houseNumbers, regionId, streetId, streetsById]
  );

  const cityContextLabel = (cityIdToLabel: string): string => {
    const city = citiesById.get(cityIdToLabel);
    return [city?.postalCode, city?.name].filter(Boolean).join(' ');
  };

  const openEditor = () => {
    setDraft(selected);
    setOpen(true);
  };
  const selectedIds = React.useMemo(() => new Set(draft.map(wasteLocationKeyId)), [draft]);
  const filtered = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('de');
    return options.filter(
      (option) =>
        (!regionId || option.regionId === regionId) &&
        (!cityId || option.cityId === cityId) &&
        (!streetId || option.streetId === streetId) &&
        (!houseNumberId || option.houseNumberId === houseNumberId) &&
        (!normalizedQuery || option.label.toLocaleLowerCase('de').includes(normalizedQuery))
    );
  }, [cityId, houseNumberId, options, query, regionId, streetId]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(
    (Math.min(page, pageCount) - 1) * pageSize,
    Math.min(page, pageCount) * pageSize
  );
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((option) => selectedIds.has(option.id));

  React.useEffect(() => setPage(1), [query, regionId, cityId, streetId, houseNumberId]);

  const toggleOption = (key: WasteLocationKey, checked: boolean) => {
    const id = wasteLocationKeyId(key);
    setDraft((current) =>
      checked
        ? [...current.filter((entry) => wasteLocationKeyId(entry) !== id), key]
        : current.filter((entry) => wasteLocationKeyId(entry) !== id)
    );
  };

  const toggleAllFiltered = (checked: boolean) => {
    const filteredIds = new Set(filtered.map((option) => option.id));
    setDraft((current) =>
      checked
        ? [
            ...current.filter((entry) => !filteredIds.has(wasteLocationKeyId(entry))),
            ...filtered.map((option) => option.key),
          ]
        : current.filter((entry) => !filteredIds.has(wasteLocationKeyId(entry)))
    );
  };

  const removeSelectedTarget = (key: WasteLocationKey) => {
    const targetId = wasteLocationKeyId(key);
    setValue(
      'wasteLocationKeys',
      selected.filter((entry) => wasteLocationKeyId(entry) !== targetId),
      { shouldDirty: true, shouldTouch: true, shouldValidate: true }
    );
  };

  return (
    <>
      <div className="space-y-4 border-t border-border/60 pt-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{pt('targeting.card.title')}</p>
          <p className="text-sm text-muted-foreground">{pt('targeting.card.description')}</p>
        </div>
        <div className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4">
          <p className="text-sm font-medium">
            {selected.length === 0
              ? pt('targeting.mode.global')
              : pt('targeting.mode.targeted', { count: selected.length })}
          </p>
          {selected.length > 0 ? (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
              {selected.map((key) => {
                const targetLabel = `${key.street}, ${key.zip} ${key.city}`;
                const isStale = staleIds.has(wasteLocationKeyId(key));
                return (
                  <li
                    key={wasteLocationKeyId(key)}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{targetLabel}</span>
                      {isStale ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          {pt('targeting.stale')}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={pt('targeting.actions.removeTarget', { address: targetLabel })}
                      onClick={() => removeSelectedTarget(key)}
                    >
                      {pt('actions.remove')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{pt('targeting.globalHint')}</p>
          )}
          <Button type="button" variant="outline" onClick={openEditor}>
            {pt('targeting.actions.edit')}
          </Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pt('targeting.dialog.title')}</DialogTitle>
            <DialogDescription>{pt('targeting.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-5">
            <Input
              aria-label={pt('targeting.filters.search')}
              placeholder={pt('targeting.filters.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Select
              aria-label={pt('targeting.filters.region')}
              value={regionId}
              onChange={(event) => {
                setRegionId(event.target.value);
                setCityId('');
                setStreetId('');
                setHouseNumberId('');
              }}
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
              value={cityId}
              onChange={(event) => {
                setCityId(event.target.value);
                setStreetId('');
                setHouseNumberId('');
              }}
            >
              <option value="">{pt('targeting.filters.allCities')}</option>
              {filteredCities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </Select>
            <Select
              aria-label={pt('targeting.filters.street')}
              value={streetId}
              onChange={(event) => {
                setStreetId(event.target.value);
                setHouseNumberId('');
              }}
            >
              <option value="">{pt('targeting.filters.allStreets')}</option>
              {filteredStreets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {cityContextLabel(item.cityId)}
                  </option>
                ))}
            </Select>
            <Select
              aria-label={pt('targeting.filters.houseNumber')}
              value={houseNumberId}
              onChange={(event) => setHouseNumberId(event.target.value)}
            >
              <option value="">{pt('targeting.filters.allHouseNumbers')}</option>
              {filteredHouseNumbers.map((item) => {
                const street = streetsById.get(item.streetId);
                return (
                  <option key={item.id} value={item.id}>
                    {item.number} — {street?.name}, {cityContextLabel(street?.cityId ?? '')}
                  </option>
                );
              })}
            </Select>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="min-w-full border-collapse" aria-label={pt('targeting.table.label')}>
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left">
                    <Checkbox
                      aria-label={pt('targeting.actions.selectAll')}
                      checked={allFilteredSelected}
                      onChange={(event) => toggleAllFiltered(event.target.checked)}
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
                {visible.map((option) => (
                  <tr key={option.id} className="border-b last:border-0">
                    <td className="p-3">
                      <Checkbox
                        aria-label={option.label}
                        checked={selectedIds.has(option.id)}
                        onChange={(event) => toggleOption(option.key, event.target.checked)}
                      />
                    </td>
                    <td className="p-3">{option.region || pt('targeting.table.emptyValue')}</td>
                    <td className="p-3">
                      {option.postalCode} {option.city}
                    </td>
                    <td className="p-3">{option.street}</td>
                    <td className="p-3">
                      {option.houseNumber || pt('targeting.table.emptyValue')}
                    </td>
                    <td className="p-3">{option.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {pt('targeting.table.empty')}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>{pt('targeting.table.resultCount', { count: filtered.length })}</span>
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
                {Math.min(page, pageCount)} / {pageCount}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {pt('actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setValue('wasteLocationKeys', [...draft], { shouldDirty: true });
                setOpen(false);
              }}
            >
              {pt('targeting.actions.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
