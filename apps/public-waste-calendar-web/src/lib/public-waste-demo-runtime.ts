import {
  buildPublicWasteLocationKey,
  type PublicWasteCalendarEntry,
  type PublicWasteSelectionState,
  type PublicWasteSelectionStep,
} from './public-waste-contract.js';
import { buildPublicWastePdfLinks } from './public-waste-api.js';
import { PUBLIC_WASTE_PREFERENCE_COOKIE } from './public-waste-preferences.server.js';
import { projectPublicWasteCalendar } from './public-waste-projection.js';
import { resolvePublicWasteSelection } from './public-waste-resolver.js';

const DEMO_REFERENCE_DATE = '2026-05-18';
const DEMO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEMO_PDF_TEMPLATE = 'https://example.invalid/public-waste/{year}/{locationKey}.pdf';

const demoRegions = [{ id: 'r-1', label: 'Musterregion' }] as const;
const demoCities = [
  { id: 'c-1', label: 'Musterstadt', regionId: 'r-1' },
  { id: 'c-2', label: 'Nebenort', regionId: 'r-1' },
] as const;
const demoStreets = [
  { id: 's-1', label: 'Hauptstraße', cityId: 'c-1' },
  { id: 's-2', label: 'Bahnhofstraße', cityId: 'c-1' },
  { id: 's-3', label: 'Dorfplatz', cityId: 'c-2' },
] as const;
const demoHouseNumbers = [
  { id: 'h-12', label: '12', streetId: 's-1' },
  { id: 'h-14', label: '14', streetId: 's-1' },
  { id: 'h-1', label: '1', streetId: 's-2' },
  { id: 'h-3', label: '3', streetId: 's-3' },
] as const;

const demoCalendarEntriesByLocationKey: Record<string, readonly PublicWasteCalendarEntry[]> = {
  'r-1:c-1:s-1:h-12': [
    {
      id: 'pickup-1',
      date: '2026-05-19',
      fractionId: 'bio',
      fractionLabel: 'Bioabfall',
      note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
    },
    {
      id: 'pickup-2',
      date: '2026-05-26',
      fractionId: 'paper',
      fractionLabel: 'Papier',
      note: null,
    },
  ],
  'r-1:c-1:s-1:h-14': [
    {
      id: 'pickup-3',
      date: '2026-05-20',
      fractionId: 'bio',
      fractionLabel: 'Bioabfall',
      note: null,
    },
  ],
  'r-1:c-1:s-2:h-1': [
    {
      id: 'pickup-4',
      date: '2026-05-21',
      fractionId: 'residual',
      fractionLabel: 'Restabfall',
      note: null,
    },
  ],
  'r-1:c-2:s-3:h-3': [
    {
      id: 'pickup-5',
      date: '2026-05-22',
      fractionId: 'glass',
      fractionLabel: 'Glas',
      note: null,
    },
  ],
};

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
      readonly calendarModel: ReturnType<typeof projectPublicWasteCalendar> & { readonly locationKey: string };
      readonly pdfLinks: readonly string[];
      readonly icalUrl: string;
      readonly restoredLocationNotice?: string;
    };

const selectionStepLabels = {
  region: 'Region',
  city: 'Ort',
  street: 'Straße',
  houseNumber: 'Hausnummer',
} as const;

const readCookieValue = (cookieHeader: string, name: string): string | null => {
  const cookieName = `${name}=`;
  for (const rawPart of cookieHeader.split(';')) {
    const part = rawPart.trim();
    if (!part.startsWith(cookieName)) {
      continue;
    }

    return decodeURIComponent(part.slice(cookieName.length));
  }

  return null;
};

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
  const regionId = selection.regionId ?? (demoRegions.length === 1 ? demoRegions[0]?.id : undefined);
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
  const cityLabel = demoCities.find((entry) => entry.id === selection.cityId)?.label ?? selection.cityId;
  const streetLabel = demoStreets.find((entry) => entry.id === selection.streetId)?.label ?? selection.streetId;
  const houseNumberLabel =
    demoHouseNumbers.find((entry) => entry.id === selection.houseNumberId)?.label ?? selection.houseNumberId;

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
  const { normalizedSelection, availableCities, availableStreets, availableHouseNumbers } = getScopedOptions(
    input.selection
  );

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
      upcomingEntries: calendarEntries,
    }),
  };

  return {
    selectionState: 'complete',
    selection: completeSelection,
    selectionSummary: buildSelectionSummary(completeSelection),
    calendarModel,
    pdfLinks: buildPublicWastePdfLinks({
      urlTemplate: DEMO_PDF_TEMPLATE,
      locationKey,
      year: Number(DEMO_REFERENCE_DATE.slice(0, 4)),
    }),
    icalUrl: buildIcalUrl(completeSelection),
    restoredLocationNotice: input.restoredLocationNotice,
  };
};

export const readDemoPublicWasteSelectionFromCookie = (): Required<PublicWasteSelectionState> | null => {
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

export const writeDemoPublicWasteSelectionCookie = (selection: Required<PublicWasteSelectionState>): void => {
  document.cookie = [
    `${PUBLIC_WASTE_PREFERENCE_COOKIE}=${encodeURIComponent(buildPublicWasteLocationKey(selection))}`,
    'Path=/',
    `Max-Age=${DEMO_COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ].join('; ');
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
