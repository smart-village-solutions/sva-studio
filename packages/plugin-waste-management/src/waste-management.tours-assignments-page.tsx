import { useEffect, useRef, useState, type RefObject } from 'react';
import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useBlocker } from '@tanstack/react-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  StudioErrorState,
} from '@sva/studio-ui-react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { WastePendingSaveButton } from './waste-management.pending-save-button.js';
import { normalizeWasteManagementSearchParams } from './search-params.js';
import { formatTourDateRange } from './waste-management.tours.presentation.js';
import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';
import {
  TourAssignmentsPageFilters,
  useTourAssignmentLocationFilters,
} from './waste-management.tours-assignments-page.filters.js';
import {
  TourAssignmentsPageSelection,
  useTourAssignmentSelection,
} from './waste-management.tours-assignments-page.selection.js';

type TourAssignmentsPageProps = {
  readonly tour: WasteTourRecord;
  readonly locations: readonly TourAssignmentLocationOption[];
  readonly saving: boolean;
  readonly loading?: boolean;
  readonly unavailable?: boolean;
  readonly message: StatusMessage | null;
  readonly onBack: () => void;
  readonly onSubmit: (changes: ReadonlyMap<string, boolean>) => void;
};

export const TourAssignmentsPage = ({
  tour,
  locations,
  saving,
  loading = false,
  unavailable = false,
  message,
  onBack,
  onSubmit,
}: TourAssignmentsPageProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [page, setPage] = useState(1);
  const { filteredLocations, filterProps } = useTourAssignmentLocationFilters(locations, () => setPage(1));
  const { hasChanges, selectionChanges, selectionProps } = useTourAssignmentSelection({
    locations,
    filteredLocations,
    loading,
    unavailable,
    page,
    setPage,
  });
  const firstFocus = useRef<HTMLButtonElement>(null);
  const focusedOnEntry = useRef(false);
  useEffect(() => {
    if (!focusedOnEntry.current) {
      firstFocus.current?.focus();
      focusedOnEntry.current = true;
    }
  }, []);
  const submitDisabled = loading || unavailable || !hasChanges;
  return (
    <div className="space-y-4">
      <TourAssignmentsPageHeader tour={tour} firstFocus={firstFocus} onBack={onBack} saving={saving} />
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!submitDisabled && !saving) onSubmit(selectionChanges);
        }}
      >
        <StatusNotice message={message} />
        {unavailable && !loading ? (
          <StudioErrorState>{pt('tours.messages.loadError')}</StudioErrorState>
        ) : null}
        <fieldset disabled={saving} className="min-w-0 space-y-4">
          <TourAssignmentsPageFilters {...filterProps} />
          <TourAssignmentsPageSelection {...selectionProps} />
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
          <Button type="button" variant="secondary" onClick={onBack} disabled={saving}>
            {pt('tours.assignments.actions.cancel')}
          </Button>
          <WastePendingSaveButton
            type="submit"
            saving={saving}
            disabled={submitDisabled}
            label={pt(
              saving ? 'tours.assignments.actions.saving' : 'tours.assignments.actions.save'
            )}
          />
        </div>
      </form>
      <TourAssignmentsDiscardDialog tourId={tour.id} hasChanges={hasChanges} saving={saving} />
    </div>
  );
};

const TourAssignmentsPageHeader = ({
  tour,
  firstFocus,
  onBack,
  saving,
}: Pick<TourAssignmentsPageProps, 'tour' | 'onBack' | 'saving'> & {
  readonly firstFocus: RefObject<HTMLButtonElement | null>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const period = formatTourDateRange(pt, tour);
  return (
  <header className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0 space-y-1">
      <h2 className="break-words text-base font-semibold">{tour.name}</h2>
      {period ? (
        <p className="text-sm text-muted-foreground">{period}</p>
      ) : null}
    </div>
    <Button
      ref={firstFocus}
      type="button"
      variant="secondary"
      onClick={onBack}
      disabled={saving}
    >
      {pt('tours.assignments.actions.backToList')}
    </Button>
  </header>
  );
};

const TourAssignmentsDiscardDialog = ({
  tourId,
  hasChanges,
  saving,
}: {
  readonly tourId: string;
  readonly hasChanges: boolean;
  readonly saving: boolean;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const focusBeforeDiscard = useRef<HTMLElement | null>(null);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (!hasChanges) return false;
      const nextSearch = normalizeWasteManagementSearchParams(
        next.search as Record<string, unknown>
      );
      return (
        current.pathname !== next.pathname ||
        nextSearch.tab !== 'tours' ||
        nextSearch.toursView !== 'assignments' ||
        nextSearch.tourId !== tourId
      );
    },
    enableBeforeUnload: hasChanges,
    withResolver: true,
  });

  return (
  <AlertDialog open={blocker.status === 'blocked'}>
    <AlertDialogContent
      onEscapeKeyDown={() => blocker.reset?.()}
      onOpenAutoFocus={() => {
        const active = document.activeElement;
        focusBeforeDiscard.current = active instanceof HTMLElement ? active : null;
      }}
      onCloseAutoFocus={(event) => {
        if (focusBeforeDiscard.current?.isConnected) {
          event.preventDefault();
          focusBeforeDiscard.current.focus();
        }
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{pt('tours.assignments.discard.title')}</AlertDialogTitle>
        <AlertDialogDescription>
          {pt('tours.assignments.discard.description')}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => blocker.reset?.()}>
          {pt('tours.assignments.discard.keepEditing')}
        </AlertDialogCancel>
        <AlertDialogAction disabled={saving} onClick={() => blocker.proceed?.()}>
          {pt('tours.assignments.discard.discardAndReturn')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  );
};
