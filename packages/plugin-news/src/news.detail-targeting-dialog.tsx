import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';

import {
  TargetingFilters,
  TargetingPagination,
  TargetingTable,
} from './news.detail-targeting-dialog.parts.js';
import { useNewsTargetingEditor } from './news.detail-targeting-state.js';
import type { NewsTargetingTranslator } from './news.detail-targeting-tab.js';
import type { NewsWasteTargetOption } from './news.waste-targeting.js';
import type { WasteLocationKey } from './news.types.js';
import type { WasteTargetingAvailability } from './news.waste-payload.js';
import type { WasteManagementMasterDataOverview } from '@sva/plugin-sdk';

type NewsDetailTargetingDialogProps = Readonly<{
  overview: WasteManagementMasterDataOverview;
  options: readonly NewsWasteTargetOption[];
  selected: readonly WasteLocationKey[];
  pt: NewsTargetingTranslator;
  onApply: (selection: readonly WasteLocationKey[]) => void;
  availability?: WasteTargetingAvailability;
  onBeforeOpen?: () => Promise<boolean>;
}>;

export function NewsDetailTargetingDialog({
  overview,
  options,
  selected,
  pt,
  onApply,
  availability = 'available',
  onBeforeOpen,
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
  const openEditor = async () => {
    if (onBeforeOpen && !(await onBeforeOpen())) {
      return;
    }
    editor.openEditor();
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={availability === 'loading'}
        onClick={() => void openEditor()}
      >
        {availability === 'loading'
          ? pt('targeting.actions.loading')
          : pt('targeting.actions.edit')}
      </Button>
      {availability === 'load-error' ? (
        <p role="alert" className="text-sm text-destructive">
          {pt('targeting.loadError')}
        </p>
      ) : null}
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
            selectedCount={editor.selectedIds.size}
            page={editor.page}
            pageCount={editor.pageCount}
            pt={pt}
            setPage={editor.setPage}
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => editor.setOpen(false)}>
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
