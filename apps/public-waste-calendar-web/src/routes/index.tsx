import React from 'react';

import { PublicWasteRootDocument } from './__root.js';
import { PublicWasteApp } from '../components/public-waste-app.js';
import type { PublicWasteSelectionPathItem } from '../components/public-waste-selection-form.js';
import {
  requestPublicWasteCalendar,
  requestPublicWasteSelection,
  type PublicWasteCalendarResponse,
  type PublicWasteSelectionResponse,
} from '../lib/public-waste-api.js';
import {
  buildPublicWasteLocationKey,
  parsePublicWasteLocationKey,
  type PublicWasteResolvedSelection,
  type PublicWasteSelectionState,
} from '../lib/public-waste-contract.js';
import {
  PUBLIC_WASTE_PREFERENCE_COOKIE,
  readPublicWasteCookieValue,
  serializeClearedPublicWastePreferenceCookie,
  serializePublicWastePreferenceCookie,
} from '../lib/public-waste-preferences.shared.js';

const REFERENCE_DATE = new Date().toISOString().slice(0, 10);

const selectionStepLabels: Record<PublicWasteSelectionResponse['step'], string> = {
  region: 'Region',
  city: 'Ort',
  street: 'Straße',
  houseNumber: 'Hausnummer',
};

const selectionStepKeys = {
  region: 'regionId',
  city: 'cityId',
  street: 'streetId',
  houseNumber: 'houseNumberId',
} as const;

type SelectionStepKey = (typeof selectionStepKeys)[keyof typeof selectionStepKeys];

const appendSelectionPathItem = (
  selectionPath: readonly PublicWasteSelectionPathItem[],
  response: Pick<PublicWasteSelectionResponse, 'step'>,
  option: { readonly label: string }
): readonly PublicWasteSelectionPathItem[] => [
  ...selectionPath,
  {
    step: selectionStepLabels[response.step],
    label: option.label,
  },
];

const readStoredLocationSelection = (): PublicWasteResolvedSelection | null => {
  const locationKey = readPublicWasteCookieValue(document.cookie, PUBLIC_WASTE_PREFERENCE_COOKIE);
  if (!locationKey) {
    return null;
  }

  return parsePublicWasteLocationKey(locationKey);
};

const writeStoredLocationSelection = (selection: PublicWasteResolvedSelection): void => {
  document.cookie = serializePublicWastePreferenceCookie({
    locationKey: buildPublicWasteLocationKey(selection),
  });
};

const applySelectionStep = (
  selection: PublicWasteSelectionState,
  step: PublicWasteSelectionResponse['step'],
  optionId: string
): PublicWasteSelectionState => {
  if (step === 'region') {
    return { regionId: optionId };
  }
  if (step === 'city') {
    return { ...selection, cityId: optionId, streetId: undefined, houseNumberId: undefined };
  }
  if (step === 'street') {
    return { ...selection, streetId: optionId, houseNumberId: undefined };
  }
  return { ...selection, houseNumberId: optionId };
};

type PageState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'incomplete';
      readonly selection: PublicWasteSelectionState;
      readonly selectionPath: readonly PublicWasteSelectionPathItem[];
      readonly step: PublicWasteSelectionResponse['step'];
      readonly nextStepLabel: string;
      readonly options: PublicWasteSelectionResponse['options'];
    }
  | ({
      readonly status: 'complete';
      readonly selection: PublicWasteResolvedSelection;
      readonly selectionPath: readonly PublicWasteSelectionPathItem[];
    } & PublicWasteCalendarResponse)
  | { readonly status: 'error'; readonly message: string };

const resolveSelectionState = async (
  initialSelection: PublicWasteSelectionState,
  initialSelectionPath: readonly PublicWasteSelectionPathItem[],
  preferredSelection?: PublicWasteResolvedSelection
): Promise<
  | {
      readonly status: 'incomplete';
      readonly selection: PublicWasteSelectionState;
      readonly selectionPath: readonly PublicWasteSelectionPathItem[];
      readonly step: PublicWasteSelectionResponse['step'];
      readonly nextStepLabel: string;
      readonly options: PublicWasteSelectionResponse['options'];
    }
  | ({
      readonly status: 'complete';
      readonly selection: PublicWasteResolvedSelection;
      readonly selectionPath: readonly PublicWasteSelectionPathItem[];
    } & PublicWasteCalendarResponse)
> => {
  let selection = initialSelection;
  let selectionPath = [...initialSelectionPath];

  for (;;) {
    const response = await requestPublicWasteSelection(selection);

    if (response.options.length === 0) {
      if (!selection.cityId || !selection.streetId) {
        throw new Error('public_waste_selection_unresolved');
      }

      const calendar = await requestPublicWasteCalendar({
        selection: {
          cityId: selection.cityId,
          streetId: selection.streetId,
          ...(selection.regionId ? { regionId: selection.regionId } : {}),
          ...(selection.houseNumberId ? { houseNumberId: selection.houseNumberId } : {}),
        },
        referenceDate: REFERENCE_DATE,
      });
      return {
        status: 'complete',
        selection: {
          cityId: selection.cityId,
          streetId: selection.streetId,
          ...(selection.regionId ? { regionId: selection.regionId } : {}),
          ...(selection.houseNumberId ? { houseNumberId: selection.houseNumberId } : {}),
        },
        selectionPath,
        ...calendar,
      };
    }

    const preferredOptionId = preferredSelection?.[selectionStepKeys[response.step]];
    const selectedOption =
      response.options.find((option) => option.id === preferredOptionId) ??
      (response.options.length === 1 ? response.options[0] : undefined);

    if (selectedOption) {
      selection = applySelectionStep(selection, response.step, selectedOption.id);
      selectionPath = appendSelectionPathItem(selectionPath, response, selectedOption);
      continue;
    }

    return {
      status: 'incomplete',
      selection,
      selectionPath,
      step: response.step,
      nextStepLabel: selectionStepLabels[response.step],
      options: response.options,
    };
  }
};

const trimSelectionToStep = (selection: PublicWasteSelectionState, stepIndex: number): PublicWasteSelectionState => {
  const keysInOrder: readonly SelectionStepKey[] = ['regionId', 'cityId', 'streetId', 'houseNumberId'];
  const nextSelection: PublicWasteSelectionState = {};

  for (let index = 0; index < stepIndex; index += 1) {
    const key = keysInOrder[index];
    const value = selection[key];
    if (value) {
      Object.assign(nextSelection, { [key]: value });
    }
  }

  return nextSelection;
};

export function PublicWasteIndexPage() {
  const [pageState, setPageState] = React.useState<PageState>({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const restoredSelection = readStoredLocationSelection();
        const nextState = await resolveSelectionState({}, [], restoredSelection ?? undefined);
        if (cancelled) {
          return;
        }

        if (restoredSelection && nextState.status !== 'complete') {
          document.cookie = serializeClearedPublicWastePreferenceCookie();
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
      } catch {
        if (!cancelled) {
          setPageState({
            status: 'error',
            message: 'Die öffentlichen Abfallkalender-Daten konnten nicht geladen werden.',
          });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

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
        nextSelectionPath
      );

      if (nextState.status === 'complete') {
        writeStoredLocationSelection(nextState.selection);
      }

      React.startTransition(() => {
        setPageState(nextState);
      });
    } catch {
      setPageState({
        status: 'error',
        message: 'Die öffentlichen Abfallkalender-Daten konnten nicht geladen werden.',
      });
    }
  };

  const handleEditSelectionStep = async (stepIndex: number) => {
    if (pageState.status !== 'incomplete') {
      return;
    }

    try {
      const nextState = await resolveSelectionState(
        trimSelectionToStep(pageState.selection, stepIndex),
        pageState.selectionPath.slice(0, stepIndex)
      );
      React.startTransition(() => {
        setPageState(nextState);
      });
    } catch {
      setPageState({
        status: 'error',
        message: 'Die öffentlichen Abfallkalender-Daten konnten nicht geladen werden.',
      });
    }
  };

  const handleResetLocation = async () => {
    document.cookie = serializeClearedPublicWastePreferenceCookie();
    try {
      const nextState = await resolveSelectionState({}, []);
      React.startTransition(() => {
        setPageState(nextState);
      });
    } catch {
      setPageState({
        status: 'error',
        message: 'Die öffentlichen Abfallkalender-Daten konnten nicht geladen werden.',
      });
    }
  };

  return (
    <PublicWasteRootDocument>
      <main className="panel">
        {pageState.status === 'loading' ? (
          <p className="body-copy">Abfallkalender wird geladen.</p>
        ) : pageState.status === 'error' ? (
          <p className="body-copy">{pageState.message}</p>
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
            selectionState="complete"
            selectionSummary={pageState.selectionSummary}
            calendarModel={pageState}
            pdfLinks={pageState.pdfLinks}
            icalUrl={pageState.icalUrl}
            onChangeLocation={handleResetLocation}
          />
        )}
      </main>
    </PublicWasteRootDocument>
  );
}
