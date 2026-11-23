import type { WasteCollectionLocationRecord } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useRef, useState } from 'react';
import { StudioDestructiveActionDialog } from '@sva/studio-ui-react';
import {
  WasteMasterDataLocationsTableToolbar,
  createLocationsTableMaps,
  type WasteMasterDataLocationsTableProps,
} from './waste-management.master-data-locations-table.parts.js';
import { WasteMasterDataLocationsTableSection } from './waste-management.master-data-locations-table.section.js';
import { WastePanelTableBottomBar } from './waste-management.table-frame.js';

export const WasteMasterDataLocationsTable = (props: WasteMasterDataLocationsTableProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const maps = createLocationsTableMaps(props);
  const [pendingDeleteLocation, setPendingDeleteLocation] =
    useState<WasteCollectionLocationRecord | null>(null);
  const [bulkDeleteRequested, setBulkDeleteRequested] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const feedbackFocusFallbackRef = useRef<HTMLElement | null>(null);

  return (
    <>
      <section
        ref={feedbackFocusFallbackRef}
        tabIndex={-1}
        aria-label={pt('masterData.locationsWorkspace.table.caption')}
        className="rounded-none border border-border-subtle bg-card"
      >
        <WasteMasterDataLocationsTableToolbar
          {...props}
          onRequestDeleteSelected={() => {
            setDeleteError(null);
            setBulkDeleteRequested(true);
          }}
        />
        {props.toolContent}
        <WasteMasterDataLocationsTableSection
          search={props.search}
          collectionLocations={props.collectionLocations}
          allFilteredLocationsSelected={props.allFilteredLocationsSelected}
          sortMode={props.sortMode}
          sortDirection={props.sortDirection}
          onSort={props.onApplyFilters}
          maps={maps}
          matchingSelectedLocationsCount={props.matchingSelectedLocationsCount}
          selectedLocationIds={props.selectedLocationIds}
          onToggleSelectAll={props.onToggleSelectAll}
          onToggleLocation={props.onToggleLocation}
          onCopyLocation={props.onCopyLocation}
          onDeleteLocation={async (location) => {
            setDeleteError(null);
            setPendingDeleteLocation(location);
          }}
          onOpenEditLocation={props.onOpenEditLocation}
          onOpenEditTour={props.onOpenEditTour}
        />
        {props.collectionLocations.length > 0 ? (
          <WastePanelTableBottomBar
            pt={pt}
            page={props.page}
            pageSize={props.pageSize}
            pageCount={props.pageCount}
            totalItems={props.totalItems}
            onPageChange={props.onPageChange}
            onPageSizeChange={props.onPageSizeChange}
          />
        ) : null}
      </section>
      <StudioDestructiveActionDialog
        open={pendingDeleteLocation !== null}
        title={pt('masterData.collectionLocations.actions.delete')}
        description={
          pendingDeleteLocation
            ? pt('masterData.collectionLocations.dialog.deleteDescription', {
                value: props.getLocationLabel(pendingDeleteLocation),
              })
            : ''
        }
        confirmLabel={pt('masterData.collectionLocations.actions.delete')}
        pendingLabel={pt('common.deleting')}
        cancelLabel={pt('masterData.collectionLocations.actions.cancel')}
        pending={deletePending}
        errorMessage={deleteError}
        fallbackFocusRef={feedbackFocusFallbackRef}
        onCancel={() => {
          setDeleteError(null);
          setPendingDeleteLocation(null);
        }}
        onConfirm={async () => {
          if (!pendingDeleteLocation) {
            return;
          }
          setDeletePending(true);
          setDeleteError(null);
          try {
            await props.onDeleteLocation(pendingDeleteLocation);
            setPendingDeleteLocation(null);
          } catch {
            setDeleteError(pt('masterData.collectionLocations.messages.deleteError'));
          } finally {
            setDeletePending(false);
          }
        }}
      />
      <StudioDestructiveActionDialog
        open={bulkDeleteRequested}
        title={pt('masterData.collectionLocations.bulk.dialog.deleteTitle')}
        description={pt('masterData.collectionLocations.bulk.dialog.deleteDescription', {
          value: props.selectedCollectionLocationsCount,
        })}
        confirmLabel={pt('masterData.collectionLocations.bulk.actions.deleteSelected')}
        pendingLabel={pt('common.deleting')}
        cancelLabel={pt('masterData.collectionLocations.actions.cancel')}
        pending={deletePending}
        errorMessage={deleteError}
        fallbackFocusRef={feedbackFocusFallbackRef}
        onCancel={() => {
          setDeleteError(null);
          setBulkDeleteRequested(false);
        }}
        onConfirm={async () => {
          setDeletePending(true);
          setDeleteError(null);
          try {
            await props.onDeleteLocations(props.selectedLocationIds);
            setBulkDeleteRequested(false);
          } catch {
            setDeleteError(pt('masterData.collectionLocations.bulk.messages.deleteError'));
          } finally {
            setDeletePending(false);
          }
        }}
      />
    </>
  );
};
