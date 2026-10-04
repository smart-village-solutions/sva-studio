import {
  buildPublicWasteLocationKey,
  type PublicWasteSelectionState,
  type PublicWasteSelectionStep,
} from './public-waste-contract.js';
import {
  PUBLIC_WASTE_PREFERENCE_COOKIE,
  readPublicWasteCookieValue,
  serializePublicWastePreferenceCookie,
} from './public-waste-preferences.shared.js';
import { projectPublicWasteCalendar } from './public-waste-projection.js';
import { resolvePublicWasteSelection } from './public-waste-resolver.js';

const DEMO_REFERENCE_DATE = '2026-05-18';
const DEMO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

import {
  demoRegions,
  demoCities,
  demoStreets,
  demoHouseNumbers,
  demoCalendarEntriesByLocationKey,
} from './public-waste-demo-data.js';

type DemoPageState =
  | {
      readonly selectionState: 'incomplete';
      readonly selection: PublicWasteSelectionState;
      readonly step: Exclude<PublicWasteSelectionStep, 'complete'>;
      readonly nextStepLabel: string;
      readonly selectionOptions: readonly { readonly id: string; readonly label: string }[];
      readonly restoredLocationNotice?: string;
    }
  | {
      readonly selectionState: 'complete';
      readonly selection: Required<PublicWasteSelectionState>;
      readonly selectionSummary: string;
      readonly calendarModel: ReturnType<typeof projectPublicWasteCalendar> & {
        readonly locationKey: string;
      };
      readonly icalUrl: string;
      readonly restoredLocationNotice?: string;
    };

const selectionStepLabels = {
  region: 'Region',
  city: 'Ort',
  street: 'Straße',
  houseNumber: 'Hausnummer',
} as const;

const readCookieValue = (cookieHeader: string, name: string): string | null =>
  readPublicWasteCookieValue(cookieHeader, name);

const parseLocationKey = (locationKey: string): Required<PublicWasteSelectionState> | null => {
  const [regionId, cityId, streetId, houseNumberId] = locationKey.split(':');
  if (!regionId || !cityId || !streetId || !houseNumberId) {
    return null;
  }

  return {
    regionId,
    cityId,
    streetId,
    houseNumberId,
  };
};

const normalizeSelection = (selection: PublicWasteSelectionState): PublicWasteSelectionState => {
  const regionId =
    selection.regionId ?? (demoRegions.length === 1 ? demoRegions[0]?.id : undefined);
  return {
    ...(regionId ? { regionId } : {}),
    ...(selection.cityId ? { cityId: selection.cityId } : {}),
    ...(selection.streetId ? { streetId: selection.streetId } : {}),
    ...(selection.houseNumberId ? { houseNumberId: selection.houseNumberId } : {}),
  };
};

const getScopedOptions = (selection: PublicWasteSelectionState) => {
  const normalizedSelection = normalizeSelection(selection);
  const availableCities = normalizedSelection.regionId
    ? demoCities.filter((entry) => entry.regionId === normalizedSelection.regionId)
    : [];
  const availableStreets = normalizedSelection.cityId
    ? demoStreets.filter((entry) => entry.cityId === normalizedSelection.cityId)
    : [];
  const availableHouseNumbers = normalizedSelection.streetId
    ? demoHouseNumbers.filter((entry) => entry.streetId === normalizedSelection.streetId)
    : [];

  return {
    normalizedSelection,
    availableCities,
    availableStreets,
    availableHouseNumbers,
  };
};

const buildSelectionSummary = (selection: Required<PublicWasteSelectionState>): string => {
  const cityLabel =
    demoCities.find((entry) => entry.id === selection.cityId)?.label ?? selection.cityId;
  const streetLabel =
    demoStreets.find((entry) => entry.id === selection.streetId)?.label ?? selection.streetId;
  const houseNumberLabel =
    demoHouseNumbers.find((entry) => entry.id === selection.houseNumberId)?.label ??
    selection.houseNumberId;

  return `${cityLabel}, ${streetLabel} ${houseNumberLabel}`;
};

const buildIcalUrl = (selection: Required<PublicWasteSelectionState>): string => {
  const params = new URLSearchParams({
    regionId: selection.regionId,
    cityId: selection.cityId,
    streetId: selection.streetId,
    houseNumberId: selection.houseNumberId,
    calendarName: buildSelectionSummary(selection),
  });

  return `https://example.invalid/public-waste/calendar.ics?${params.toString()}`;
};

export const resolveDemoPublicWastePageState = (input: {
  readonly selection: PublicWasteSelectionState;
  readonly restoredLocationNotice?: string;
}): DemoPageState => {
  const { normalizedSelection, availableCities, availableStreets, availableHouseNumbers } =
    getScopedOptions(input.selection);

  const resolution = resolvePublicWasteSelection({
    availableRegions: demoRegions,
    availableCities,
    availableStreets,
    availableHouseNumbers,
    selected: normalizedSelection,
  });

  if (resolution.status === 'incomplete') {
    const selectionOptions =
      resolution.nextStep === 'region'
        ? demoRegions
        : resolution.nextStep === 'city'
          ? availableCities
          : resolution.nextStep === 'street'
            ? availableStreets
            : availableHouseNumbers;

    return {
      selectionState: 'incomplete',
      selection: normalizedSelection,
      step: resolution.nextStep,
      nextStepLabel: selectionStepLabels[resolution.nextStep],
      selectionOptions,
      restoredLocationNotice: input.restoredLocationNotice,
    };
  }

  const completeSelection = normalizedSelection as Required<PublicWasteSelectionState>;
  const locationKey = buildPublicWasteLocationKey(completeSelection);
  const calendarEntries = demoCalendarEntriesByLocationKey[locationKey] ?? [];
  const calendarModel = {
    locationKey,
    ...projectPublicWasteCalendar({
      referenceDate: DEMO_REFERENCE_DATE,
      entries: calendarEntries,
    }),
  };

  return {
    selectionState: 'complete',
    selection: completeSelection,
    selectionSummary: buildSelectionSummary(completeSelection),
    calendarModel,
    icalUrl: buildIcalUrl(completeSelection),
    restoredLocationNotice: input.restoredLocationNotice,
  };
};

export const readDemoPublicWasteSelectionFromCookie =
  (): Required<PublicWasteSelectionState> | null => {
    const locationKey = readCookieValue(document.cookie, PUBLIC_WASTE_PREFERENCE_COOKIE);
    if (!locationKey) {
      return null;
    }

    const parsedSelection = parseLocationKey(locationKey);
    if (!parsedSelection) {
      return null;
    }

    const resolvedState = resolveDemoPublicWastePageState({ selection: parsedSelection });
    return resolvedState.selectionState === 'complete' ? resolvedState.selection : null;
  };

export const writeDemoPublicWasteSelectionCookie = (
  selection: Required<PublicWasteSelectionState>
): void => {
  document.cookie = serializePublicWastePreferenceCookie({
    locationKey: buildPublicWasteLocationKey(selection),
    maxAgeSeconds: DEMO_COOKIE_MAX_AGE_SECONDS,
  });
};

export const advanceDemoPublicWasteSelection = (input: {
  readonly selection: PublicWasteSelectionState;
  readonly optionId: string;
}): PublicWasteSelectionState => {
  const currentPageState = resolveDemoPublicWastePageState({ selection: input.selection });

  if (currentPageState.selectionState === 'complete') {
    return currentPageState.selection;
  }

  if (currentPageState.step === 'region') {
    return { regionId: input.optionId };
  }

  if (currentPageState.step === 'city') {
    return {
      ...currentPageState.selection,
      cityId: input.optionId,
      streetId: undefined,
      houseNumberId: undefined,
    };
  }

  if (currentPageState.step === 'street') {
    return {
      ...currentPageState.selection,
      streetId: input.optionId,
      houseNumberId: undefined,
    };
  }

  return {
    ...currentPageState.selection,
    houseNumberId: input.optionId,
  };
};
