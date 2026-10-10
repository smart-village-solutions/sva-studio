import React from 'react';
import { PublicWasteApiOriginContext } from '../lib/public-waste-api-context.js';

import { PublicWasteRootDocument } from './__root.js';
import { PublicWasteApp } from '../components/public-waste-app.js';
import { serializeClearedPublicWastePreferenceCookie } from '../lib/public-waste-preferences.shared.js';
import { createPublicWasteTranslator } from '../lib/public-waste-translations.js';
import {
  BOUND_REGION_UNAVAILABLE_ERROR,
  readPublicWasteRegionBinding,
  readStoredLocationSelection,
  resolveBoundRegionId,
  writeStoredLocationSelection,
  type PublicWasteRegionBinding,
} from './public-waste-index-binding.js';
import {
  applySelectionStep,
  resolveSelectionState,
  trimSelectionToStep,
  type PageState,
} from './public-waste-index-selection.js';

export { readPublicWasteRegionBinding } from './public-waste-index-binding.js';

export function PublicWasteIndexPage({
  binding,
  embedded = false,
}: Readonly<{ binding?: PublicWasteRegionBinding; embedded?: boolean }> = {}) {
  const apiOrigin = React.useContext(PublicWasteApiOriginContext);
  const [t] = React.useState(() =>
    createPublicWasteTranslator(document.documentElement.lang || 'de')
  );
  const [regionBinding] = React.useState<PublicWasteRegionBinding>(
    () => binding ?? readPublicWasteRegionBinding(window.location.search, window.location.pathname)
  );
  const boundRegionIdRef = React.useRef<string | undefined>(undefined);
  const [pageState, setPageState] = React.useState<PageState>({ status: 'loading' });
  const toLoadErrorMessage = (error: unknown): string =>
    error instanceof Error && error.message === BOUND_REGION_UNAVAILABLE_ERROR
      ? t('errors.boundRegionUnavailable')
      : t('errors.loadFailed');

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const restoredSelection = embedded ? null : readStoredLocationSelection();
        const boundRegionId = await resolveBoundRegionId(regionBinding, apiOrigin);
        boundRegionIdRef.current = boundRegionId;
        const preferredSelection =
          restoredSelection &&
          (!boundRegionId ||
            !restoredSelection.regionId ||
            restoredSelection.regionId.toLowerCase() === boundRegionId)
            ? restoredSelection
            : undefined;
        const nextState = await resolveSelectionState(
          boundRegionId ? { regionId: boundRegionId } : {},
          [],
          preferredSelection,
          boundRegionId,
          apiOrigin
        );
        if (cancelled) {
          return;
        }

        if (preferredSelection && nextState.status !== 'complete') {
          if (!embedded) document.cookie = serializeClearedPublicWastePreferenceCookie();
        }

        if (nextState.status === 'complete') {
          React.startTransition(() => {
            setPageState(nextState);
          });
          return;
        }

        React.startTransition(() => {
          setPageState(nextState);
        });
      } catch (error) {
        if (!cancelled) {
          setPageState({
            status: 'error',
            message: toLoadErrorMessage(error),
          });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [regionBinding, apiOrigin, embedded]);

  const handleSelectOption = async (optionId: string) => {
    if (pageState.status !== 'incomplete') {
      return;
    }

    try {
      const selectedOption = pageState.options.find((option) => option.id === optionId);
      const nextSelectionPath = selectedOption
        ? [
            ...pageState.selectionPath,
            {
              step: pageState.nextStepLabel,
              label: selectedOption.label,
            },
          ]
        : pageState.selectionPath;
      const nextState = await resolveSelectionState(
        applySelectionStep(pageState.selection, pageState.step, optionId),
        nextSelectionPath,
        undefined,
        boundRegionIdRef.current,
        apiOrigin
      );

      if (!embedded && nextState.status === 'complete') {
        writeStoredLocationSelection(nextState.selection);
      }

      React.startTransition(() => {
        setPageState(nextState);
      });
    } catch (error) {
      setPageState({
        status: 'error',
        message: toLoadErrorMessage(error),
      });
    }
  };

  const handleEditSelectionStep = async (stepIndex: number) => {
    if (pageState.status !== 'incomplete') {
      return;
    }

    try {
      const nextState = await resolveSelectionState(
        trimSelectionToStep(pageState.selection, stepIndex, boundRegionIdRef.current),
        pageState.selectionPath.slice(0, stepIndex),
        undefined,
        boundRegionIdRef.current,
        apiOrigin
      );
      React.startTransition(() => {
        setPageState(nextState);
      });
    } catch (error) {
      setPageState({
        status: 'error',
        message: toLoadErrorMessage(error),
      });
    }
  };

  const handleResetLocation = async () => {
    if (!embedded) document.cookie = serializeClearedPublicWastePreferenceCookie();
    try {
      const boundRegionId = boundRegionIdRef.current;
      const nextState = await resolveSelectionState(
        boundRegionId ? { regionId: boundRegionId } : {},
        [],
        undefined,
        boundRegionId,
        apiOrigin
      );
      React.startTransition(() => {
        setPageState(nextState);
      });
    } catch (error) {
      setPageState({
        status: 'error',
        message: toLoadErrorMessage(error),
      });
    }
  };

  const Panel = embedded ? 'div' : 'main';

  return (
    <PublicWasteRootDocument>
      <Panel className="panel">
        {pageState.status === 'loading' ? (
          <p className="body-copy" role="status" aria-live="polite">
            {t('calendar.loading')}
          </p>
        ) : pageState.status === 'error' ? (
          <p className="body-copy" role="alert">
            {pageState.message}
          </p>
        ) : pageState.status === 'incomplete' ? (
          <PublicWasteApp
            selectionState="incomplete"
            nextStepLabel={pageState.nextStepLabel}
            selectionOptions={pageState.options}
            selectionPath={pageState.selectionPath}
            onEditSelectionStep={handleEditSelectionStep}
            onSelectOption={handleSelectOption}
          />
        ) : (
          <PublicWasteApp
            selection={pageState.selection}
            selectionState="complete"
            selectionSummary={pageState.selectionSummary}
            calendarModel={pageState}
            icalUrl={pageState.icalUrl}
            calendarReminderOptions={pageState.calendarReminderOptions}
            reminderSignup={pageState.reminderSignup}
            onChangeLocation={handleResetLocation}
          />
        )}
      </Panel>
    </PublicWasteRootDocument>
  );
}
