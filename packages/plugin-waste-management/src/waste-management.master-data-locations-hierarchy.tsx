import type {
  WasteCityRecord,
  WasteHouseNumberRecord,
  WasteRegionRecord,
  WasteStreetRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import type { ReactNode } from 'react';
import { Badge, Button } from '@sva/studio-ui-react';

type HierarchySectionProps<TRecord> = {
  readonly title: string;
  readonly description: string;
  readonly emptyLabel: string;
  readonly records: readonly TRecord[];
  readonly renderLabel: (record: TRecord) => string;
  readonly renderMeta?: (record: TRecord) => ReactNode;
  readonly onOpenCreate: () => void;
  readonly onOpenEdit: (record: TRecord) => void;
  readonly createLabel: string;
  readonly editLabel: string;
};

type WasteMasterDataLocationsHierarchyProps = {
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly onOpenCreateRegion: () => void;
  readonly onOpenCreateCity: () => void;
  readonly onOpenCreateStreet: () => void;
  readonly onOpenCreateHouseNumber: () => void;
  readonly onOpenEditRegion: (region: WasteRegionRecord) => void;
  readonly onOpenEditCity: (city: WasteCityRecord) => void;
  readonly onOpenEditStreet: (street: WasteStreetRecord) => void;
  readonly onOpenEditHouseNumber: (houseNumber: WasteHouseNumberRecord) => void;
};

const HierarchySection = <TRecord,>({
  title,
  description,
  emptyLabel,
  records,
  renderLabel,
  renderMeta,
  onOpenCreate,
  onOpenEdit,
  createLabel,
  editLabel,
}: HierarchySectionProps<TRecord>) => (
  <section className="space-y-3 rounded-lg border border-border/70 bg-[rgb(var(--waste-panel-overlay))] p-4 dark:backdrop-blur-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onOpenCreate}>
        {createLabel}
      </Button>
    </div>
    {records.length ? (
      <div className="space-y-2">
        {records.map((record, index) => (
          <div key={index} className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{renderLabel(record)}</p>
              {renderMeta ? <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">{renderMeta(record)}</div> : null}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenEdit(record)}>
              {editLabel}
            </Button>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    )}
  </section>
);

const WasteRegionHierarchySection = ({
  regions,
  onOpenCreateRegion,
  onOpenEditRegion,
}: Pick<WasteMasterDataLocationsHierarchyProps, 'regions' | 'onOpenCreateRegion' | 'onOpenEditRegion'>) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <HierarchySection
      title={pt('masterData.regions.title')}
      description={pt('masterData.regions.description')}
      emptyLabel={pt('masterData.locationsWorkspace.emptyRegions')}
      records={regions}
      renderLabel={(region) => region.name}
      renderMeta={(region) => <Badge variant="outline">{pt('masterData.regions.regionId', { value: region.id })}</Badge>}
      onOpenCreate={onOpenCreateRegion}
      onOpenEdit={onOpenEditRegion}
      createLabel={pt('masterData.regions.actions.openCreate')}
      editLabel={pt('masterData.regions.actions.edit')}
    />
  );
};

const WasteCityHierarchySection = ({
  cities,
  onOpenCreateCity,
  onOpenEditCity,
}: Pick<WasteMasterDataLocationsHierarchyProps, 'cities' | 'onOpenCreateCity' | 'onOpenEditCity'>) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <HierarchySection
      title={pt('masterData.cities.title')}
      description={pt('masterData.cities.description')}
      emptyLabel={pt('masterData.locationsWorkspace.emptyCities')}
      records={cities}
      renderLabel={(city) => city.name}
      renderMeta={(city) => (
        <>
          <Badge variant="outline">{pt('masterData.cities.cityId', { value: city.id })}</Badge>
          {city.regionId ? <Badge variant="outline">{pt('masterData.cities.regionId', { value: city.regionId })}</Badge> : null}
        </>
      )}
      onOpenCreate={onOpenCreateCity}
      onOpenEdit={onOpenEditCity}
      createLabel={pt('masterData.cities.actions.openCreate')}
      editLabel={pt('masterData.cities.actions.edit')}
    />
  );
};

const WasteStreetHierarchySection = ({
  streets,
  onOpenCreateStreet,
  onOpenEditStreet,
}: Pick<WasteMasterDataLocationsHierarchyProps, 'streets' | 'onOpenCreateStreet' | 'onOpenEditStreet'>) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <HierarchySection
      title={pt('masterData.streets.title')}
      description={pt('masterData.streets.description')}
      emptyLabel={pt('masterData.locationsWorkspace.emptyStreets')}
      records={streets}
      renderLabel={(street) => street.name}
      renderMeta={(street) => (
        <>
          <Badge variant="outline">{pt('masterData.streets.streetId', { value: street.id })}</Badge>
          <Badge variant="outline">{pt('masterData.streets.cityId', { value: street.cityId })}</Badge>
        </>
      )}
      onOpenCreate={onOpenCreateStreet}
      onOpenEdit={onOpenEditStreet}
      createLabel={pt('masterData.streets.actions.openCreate')}
      editLabel={pt('masterData.streets.actions.edit')}
    />
  );
};

const WasteHouseNumberHierarchySection = ({
  houseNumbers,
  onOpenCreateHouseNumber,
  onOpenEditHouseNumber,
}: Pick<WasteMasterDataLocationsHierarchyProps, 'houseNumbers' | 'onOpenCreateHouseNumber' | 'onOpenEditHouseNumber'>) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <HierarchySection
      title={pt('masterData.houseNumbers.title')}
      description={pt('masterData.houseNumbers.description')}
      emptyLabel={pt('masterData.locationsWorkspace.emptyHouseNumbers')}
      records={houseNumbers}
      renderLabel={(houseNumber) => houseNumber.number}
      renderMeta={(houseNumber) => (
        <>
          <Badge variant="outline">{pt('masterData.houseNumbers.houseNumberId', { value: houseNumber.id })}</Badge>
          <Badge variant="outline">{pt('masterData.houseNumbers.streetId', { value: houseNumber.streetId })}</Badge>
        </>
      )}
      onOpenCreate={onOpenCreateHouseNumber}
      onOpenEdit={onOpenEditHouseNumber}
      createLabel={pt('masterData.houseNumbers.actions.openCreate')}
      editLabel={pt('masterData.houseNumbers.actions.edit')}
    />
  );
};

export const WasteMasterDataLocationsHierarchy = ({
  regions,
  cities,
  streets,
  houseNumbers,
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenEditRegion,
  onOpenEditCity,
  onOpenEditStreet,
  onOpenEditHouseNumber,
}: WasteMasterDataLocationsHierarchyProps) => {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <WasteRegionHierarchySection
        regions={regions}
        onOpenCreateRegion={onOpenCreateRegion}
        onOpenEditRegion={onOpenEditRegion}
      />
      <WasteCityHierarchySection
        cities={cities}
        onOpenCreateCity={onOpenCreateCity}
        onOpenEditCity={onOpenEditCity}
      />
      <WasteStreetHierarchySection
        streets={streets}
        onOpenCreateStreet={onOpenCreateStreet}
        onOpenEditStreet={onOpenEditStreet}
      />
      <WasteHouseNumberHierarchySection
        houseNumbers={houseNumbers}
        onOpenCreateHouseNumber={onOpenCreateHouseNumber}
        onOpenEditHouseNumber={onOpenEditHouseNumber}
      />
    </div>
  );
};
