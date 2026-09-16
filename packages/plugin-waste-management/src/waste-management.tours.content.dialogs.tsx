import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';

import type { WasteToursContentProps } from './waste-management.tours.view-model.js';
import { WasteToursBulkValidityDialog } from './waste-management.tours-bulk-validity.js';
import { WasteToursDeleteDialogs } from './waste-management.tours.content.parts.js';
import { WasteToursStatusBulkDialog } from './waste-management.tours-status-bulk-dialog.js';

type WasteToursContentDialogsProps = Pick<
  WasteToursContentProps,
  'onDeleteTour' | 'onDeleteTours' | 'onUpdateTourStatusBulk' | 'onUpdateTourValidityBulk'
> & {
  readonly annualTransferDialog: ReactNode;
  readonly allTours: readonly WasteTourRecord[];
  readonly selectedTourIds: readonly string[];
  readonly saving: boolean;
  readonly bulkDeleteOpen: boolean;
  readonly bulkValidityOpen: boolean;
  readonly bulkStatusOpen: boolean;
  readonly tourPendingDelete: WasteTourRecord | null;
  readonly tourPendingStatusChange: WasteTourRecord | null;
  readonly setSelectedTourIds: Dispatch<SetStateAction<readonly string[]>>;
  readonly setBulkDeleteOpen: (open: boolean) => void;
  readonly setBulkValidityOpen: (open: boolean) => void;
  readonly setBulkStatusOpen: (open: boolean) => void;
  readonly setTourPendingDelete: (tour: WasteTourRecord | null) => void;
  readonly setTourPendingStatusChange: (tour: WasteTourRecord | null) => void;
  readonly fallbackFocusRef: RefObject<HTMLElement | null>;
};

const WasteToursStatusDialogs = ({
  bulkStatusOpen,
  selectedTourIds,
  saving,
  onUpdateTourStatusBulk,
  setSelectedTourIds,
  setBulkStatusOpen,
  tourPendingStatusChange,
  setTourPendingStatusChange,
  fallbackFocusRef,
}: WasteToursContentDialogsProps) => (
  <>
    {bulkStatusOpen ? (
      <WasteToursStatusBulkDialog
        open
        selectedTourIds={selectedTourIds}
        saving={saving}
        onOpenChange={setBulkStatusOpen}
        onSubmit={onUpdateTourStatusBulk}
        onUpdated={() => {
          setSelectedTourIds([]);
          setBulkStatusOpen(false);
          window.setTimeout(() => fallbackFocusRef.current?.focus(), 0);
        }}
      />
    ) : null}
    {tourPendingStatusChange ? (
      <WasteToursStatusBulkDialog
        open
        selectedTourIds={[tourPendingStatusChange.id]}
        tourName={tourPendingStatusChange.name}
        currentStatus={tourPendingStatusChange.status}
        saving={saving}
        onOpenChange={(open) => !open && setTourPendingStatusChange(null)}
        onSubmit={onUpdateTourStatusBulk}
        onUpdated={() => {
          setTourPendingStatusChange(null);
          window.setTimeout(() => fallbackFocusRef.current?.focus(), 0);
        }}
      />
    ) : null}
  </>
);

export const WasteToursContentDialogs = (props: WasteToursContentDialogsProps) => (
  <>
    {props.annualTransferDialog}
    <WasteToursBulkValidityDialog
      open={props.bulkValidityOpen}
      tours={props.allTours}
      selectedTourIds={props.selectedTourIds}
      saving={props.saving}
      onOpenChange={props.setBulkValidityOpen}
      onUpdate={props.onUpdateTourValidityBulk}
      onUpdated={() => {
        props.setSelectedTourIds([]);
        props.setBulkValidityOpen(false);
      }}
    />
    <WasteToursStatusDialogs {...props} />
    <WasteToursDeleteDialogs
      tourPendingDelete={props.tourPendingDelete}
      bulkDeleteOpen={props.bulkDeleteOpen}
      selectedTourIds={props.selectedTourIds}
      onCancelSingle={() => props.setTourPendingDelete(null)}
      onCancelBulk={() => props.setBulkDeleteOpen(false)}
      onDeleteTour={props.onDeleteTour}
      onDeleteTours={props.onDeleteTours}
      onAfterBulkDelete={(failedIds) => {
        props.setSelectedTourIds(failedIds);
        props.setBulkDeleteOpen(failedIds.length > 0);
      }}
      fallbackFocusRef={props.fallbackFocusRef}
    />
  </>
);
