import type { WasteCityRecord, WasteFractionRecord, WasteHouseNumberRecord, WasteRegionRecord, WasteStreetRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button } from '@sva/studio-ui-react';

export const WasteMasterDataSummaryContent = ({
  fractions,
  regions,
  cities,
  streets,
  houseNumbers,
  onOpenCreateFraction,
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenEditFraction,
  onOpenEditRegion,
  onOpenEditCity,
  onOpenEditStreet,
  onOpenEditHouseNumber,
}: {
  readonly fractions: readonly WasteFractionRecord[];
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly onOpenCreateFraction: () => void;
  readonly onOpenCreateRegion: () => void;
  readonly onOpenCreateCity: () => void;
  readonly onOpenCreateStreet: () => void;
  readonly onOpenCreateHouseNumber: () => void;
  readonly onOpenEditFraction: (fraction: WasteFractionRecord) => void;
  readonly onOpenEditRegion: (region: WasteRegionRecord) => void;
  readonly onOpenEditCity: (city: WasteCityRecord) => void;
  readonly onOpenEditStreet: (street: WasteStreetRecord) => void;
  readonly onOpenEditHouseNumber: (houseNumber: WasteHouseNumberRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <div className="flex justify-end"><Button type="button" onClick={onOpenCreateFraction}>{pt('masterData.fractions.actions.openCreate')}</Button></div>
      <div className="flex flex-wrap gap-2"><Badge>{pt('masterData.meta.fractionCount', { value: fractions.length })}</Badge><Badge variant="outline">{pt('masterData.meta.regionCount', { value: regions.length })}</Badge><Badge variant="outline">{pt('masterData.meta.cityCount', { value: cities.length })}</Badge><Badge variant="outline">{pt('masterData.meta.streetCount', { value: streets.length })}</Badge><Badge variant="outline">{pt('masterData.meta.houseNumberCount', { value: houseNumbers.length })}</Badge></div>
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="space-y-3 rounded-lg border border-border/70 bg-[rgba(255,255,255,0.32)] p-4"><div className="space-y-1"><h3 className="text-sm font-semibold">{pt('masterData.fractions.title')}</h3><p className="text-sm text-muted-foreground">{pt('masterData.fractions.description')}</p></div><div className="space-y-2">{fractions.map((fraction) => <div key={fraction.id} className="rounded-md border border-border/60 p-3"><div className="flex items-start justify-between gap-3"><div className="space-y-1"><p className="font-medium">{fraction.name}</p>{fraction.description ? <p className="text-sm text-muted-foreground">{fraction.description}</p> : null}</div><Badge variant={fraction.active ? 'default' : 'secondary'}>{fraction.active ? pt('common.active') : pt('common.inactive')}</Badge></div><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{pt('masterData.fractions.color', { value: fraction.color })}</Badge>{fraction.containerSize ? <Badge variant="outline">{pt('masterData.fractions.containerSize', { value: fraction.containerSize })}</Badge> : null}{Object.entries(fraction.translations ?? {}).map(([locale, localizedName]) => <Badge key={`${fraction.id}-${locale}`} variant="secondary">{pt('masterData.fractions.translationBadge', { locale, value: localizedName })}</Badge>)}</div><div className="mt-3"><Button type="button" variant="outline" size="sm" onClick={() => onOpenEditFraction(fraction)}>{pt('masterData.fractions.actions.edit')}</Button></div></div>)}</div></section>
        <section className="space-y-3 rounded-lg border border-border/70 bg-[rgba(255,255,255,0.32)] p-4"><div className="space-y-1"><h3 className="text-sm font-semibold">{pt('masterData.regions.title')}</h3><p className="text-sm text-muted-foreground">{pt('masterData.regions.description')}</p></div><div><Button type="button" variant="outline" size="sm" onClick={onOpenCreateRegion}>{pt('masterData.regions.actions.openCreate')}</Button></div><div className="space-y-2">{regions.map((region) => <div key={region.id} className="rounded-md border border-border/60 p-3"><p className="font-medium">{region.name}</p><p className="text-sm text-muted-foreground">{pt('masterData.regions.regionId', { value: region.id })}</p><div className="mt-3"><Button type="button" variant="outline" size="sm" onClick={() => onOpenEditRegion(region)}>{pt('masterData.regions.actions.edit')}</Button></div></div>)}</div></section>
        <section className="space-y-3 rounded-lg border border-border/70 bg-[rgba(255,255,255,0.32)] p-4"><div className="space-y-1"><h3 className="text-sm font-semibold">{pt('masterData.cities.title')}</h3><p className="text-sm text-muted-foreground">{pt('masterData.cities.description')}</p></div><div><Button type="button" variant="outline" size="sm" onClick={onOpenCreateCity}>{pt('masterData.cities.actions.openCreate')}</Button></div><div className="space-y-2">{cities.map((city) => <div key={city.id} className="rounded-md border border-border/60 p-3"><p className="font-medium">{city.name}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{pt('masterData.cities.cityId', { value: city.id })}</Badge>{city.regionId ? <Badge variant="outline">{pt('masterData.cities.regionId', { value: city.regionId })}</Badge> : null}</div><div className="mt-3"><Button type="button" variant="outline" size="sm" onClick={() => onOpenEditCity(city)}>{pt('masterData.cities.actions.edit')}</Button></div></div>)}</div></section>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-border/70 bg-[rgba(255,255,255,0.32)] p-4"><div className="space-y-1"><h3 className="text-sm font-semibold">{pt('masterData.streets.title')}</h3><p className="text-sm text-muted-foreground">{pt('masterData.streets.description')}</p></div><div><Button type="button" variant="outline" size="sm" onClick={onOpenCreateStreet}>{pt('masterData.streets.actions.openCreate')}</Button></div><div className="space-y-2">{streets.map((street) => <div key={street.id} className="rounded-md border border-border/60 p-3"><p className="font-medium">{street.name}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{pt('masterData.streets.streetId', { value: street.id })}</Badge><Badge variant="outline">{pt('masterData.streets.cityId', { value: street.cityId })}</Badge></div><div className="mt-3"><Button type="button" variant="outline" size="sm" onClick={() => onOpenEditStreet(street)}>{pt('masterData.streets.actions.edit')}</Button></div></div>)}</div></section>
        <section className="space-y-3 rounded-lg border border-border/70 bg-[rgba(255,255,255,0.32)] p-4"><div className="space-y-1"><h3 className="text-sm font-semibold">{pt('masterData.houseNumbers.title')}</h3><p className="text-sm text-muted-foreground">{pt('masterData.houseNumbers.description')}</p></div><div><Button type="button" variant="outline" size="sm" onClick={onOpenCreateHouseNumber}>{pt('masterData.houseNumbers.actions.openCreate')}</Button></div><div className="space-y-2">{houseNumbers.map((houseNumber) => <div key={houseNumber.id} className="rounded-md border border-border/60 p-3"><p className="font-medium">{houseNumber.number}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{pt('masterData.houseNumbers.houseNumberId', { value: houseNumber.id })}</Badge><Badge variant="outline">{pt('masterData.houseNumbers.streetId', { value: houseNumber.streetId })}</Badge></div><div className="mt-3"><Button type="button" variant="outline" size="sm" onClick={() => onOpenEditHouseNumber(houseNumber)}>{pt('masterData.houseNumbers.actions.edit')}</Button></div></div>)}</div></section>
      </div>
    </>
  );
};
