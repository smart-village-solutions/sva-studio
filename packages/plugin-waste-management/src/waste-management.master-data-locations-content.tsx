import type { WasteCollectionLocationRecord } from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button, Checkbox } from '@sva/studio-ui-react';

export const WasteMasterDataLocationsContent = ({
  collectionLocations,
  selectedLocationIds,
  selectedCollectionLocationsCount,
  allFilteredLocationsSelected,
  onToggleSelectAll,
  onToggleLocation,
  onOpenCreateLocation,
  onOpenBulkAssignments,
  onOpenEditLocation,
  getLocationLabel,
  availableTours,
}: {
  readonly collectionLocations: readonly WasteCollectionLocationRecord[];
  readonly selectedLocationIds: readonly string[];
  readonly selectedCollectionLocationsCount: number;
  readonly allFilteredLocationsSelected: boolean;
  readonly availableTours: readonly unknown[];
  readonly onToggleSelectAll: (checked: boolean) => void;
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
  readonly onOpenCreateLocation: () => void;
  readonly onOpenBulkAssignments: () => void;
  readonly onOpenEditLocation: (location: WasteCollectionLocationRecord) => void;
  readonly getLocationLabel: (location: WasteCollectionLocationRecord) => string;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <div className="flex flex-wrap gap-2"><Badge variant="outline">{pt('masterData.meta.collectionLocationCount', { value: collectionLocations.length })}</Badge></div>
      <section className="space-y-3 rounded-lg border border-border/70 bg-[rgba(255,255,255,0.32)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><h3 className="text-sm font-semibold">{pt('masterData.collectionLocations.title')}</h3><p className="text-sm text-muted-foreground">{pt('masterData.collectionLocations.description')}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={onOpenCreateLocation}>{pt('masterData.collectionLocations.actions.openCreate')}</Button><Button type="button" variant="outline" size="sm" disabled={selectedCollectionLocationsCount === 0 || availableTours.length === 0} onClick={onOpenBulkAssignments}>{pt('masterData.collectionLocations.bulk.actions.openAssign', { value: selectedCollectionLocationsCount })}</Button></div></div>
        <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox checked={allFilteredLocationsSelected} onChange={(event) => onToggleSelectAll(event.currentTarget.checked)} /><span>{pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}</span></label>{selectedCollectionLocationsCount ? <Badge variant="outline">{pt('masterData.collectionLocations.bulk.meta.selectedCount', { value: selectedCollectionLocationsCount })}</Badge> : null}</div>
        <div className="grid gap-3 xl:grid-cols-2">{collectionLocations.map((location) => <div key={location.id} className="rounded-md border border-border/60 p-3"><label className="flex items-start gap-2"><Checkbox checked={selectedLocationIds.includes(location.id)} onChange={(event) => onToggleLocation(location.id, event.currentTarget.checked)} /><span className="font-medium">{getLocationLabel(location)}</span></label><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{pt('masterData.collectionLocations.meta.locationId', { value: location.id })}</Badge><Badge variant={location.active ? 'default' : 'secondary'}>{location.active ? pt('common.active') : pt('common.inactive')}</Badge></div><div className="mt-3"><Button type="button" variant="outline" size="sm" onClick={() => onOpenEditLocation(location)}>{pt('masterData.collectionLocations.actions.edit')}</Button></div></div>)}</div>
      </section>
    </>
  );
};
