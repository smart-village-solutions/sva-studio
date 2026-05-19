import {
  buildPublicWasteLocationKey,
  type PublicWasteResolvedSelection,
  type PublicWasteSelectionState,
} from './public-waste-contract.js';
import { projectPublicWasteCalendar } from './public-waste-projection.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';

export const loadNextPublicWasteSelection = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'listSelectionOptions'>;
  readonly input: {
    readonly selection: PublicWasteSelectionState;
  };
}) => {
  const result = await input.repository.listSelectionOptions({
    selection: input.input.selection,
  });

  return {
    status: 'incomplete' as const,
    step: result.step,
    options: result.options,
  };
};

export const loadResolvedPublicWasteCalendar = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries'>;
  readonly input: {
    readonly selection: PublicWasteResolvedSelection;
    readonly referenceDate: string;
  };
}) => {
  const entries = await input.repository.loadCalendarEntries({
    selection: input.input.selection,
    referenceDate: input.input.referenceDate,
  });
  const projection = projectPublicWasteCalendar({
    referenceDate: input.input.referenceDate,
    upcomingEntries: entries,
  });

  return {
    locationKey: buildPublicWasteLocationKey(input.input.selection),
    ...projection,
  };
};

const interpolatePdfTemplate = (urlTemplate: string, locationKey: string, year: number): string =>
  urlTemplate.replaceAll('{locationKey}', locationKey).replaceAll('{year}', String(year));

export const buildPublicWastePdfLinks = (input: {
  readonly urlTemplate: string;
  readonly locationKey: string;
  readonly year: number;
}): readonly string[] => [
  interpolatePdfTemplate(input.urlTemplate, input.locationKey, input.year - 1),
  interpolatePdfTemplate(input.urlTemplate, input.locationKey, input.year),
  interpolatePdfTemplate(input.urlTemplate, input.locationKey, input.year + 1),
];

export type PublicWasteSelectionResponse = {
  readonly status: 'incomplete';
  readonly step: 'region' | 'city' | 'street' | 'houseNumber';
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
  }[];
};

export type PublicWasteCalendarResponse = Awaited<ReturnType<typeof loadResolvedPublicWasteCalendar>> & {
  readonly selectionSummary: string;
  readonly pdfLinks: readonly string[];
  readonly icalUrl: string;
};

const toSearchParams = (selection: PublicWasteSelectionState): URLSearchParams => {
  const params = new URLSearchParams();
  if (selection.regionId) params.set('regionId', selection.regionId);
  if (selection.cityId) params.set('cityId', selection.cityId);
  if (selection.streetId) params.set('streetId', selection.streetId);
  if (selection.houseNumberId) params.set('houseNumberId', selection.houseNumberId);
  return params;
};

export const requestPublicWasteSelection = async (selection: PublicWasteSelectionState): Promise<PublicWasteSelectionResponse> => {
  const response = await fetch(`/api/public-waste/selection?${toSearchParams(selection).toString()}`);
  if (!response.ok) {
    throw new Error(`public_waste_selection_failed:${response.status}`);
  }
  return (await response.json()) as PublicWasteSelectionResponse;
};

export const requestPublicWasteCalendar = async (input: {
  readonly selection: PublicWasteResolvedSelection;
  readonly referenceDate: string;
}): Promise<PublicWasteCalendarResponse> => {
  const params = toSearchParams(input.selection);
  params.set('referenceDate', input.referenceDate);
  const response = await fetch(`/api/public-waste/calendar?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`public_waste_calendar_failed:${response.status}`);
  }
  return (await response.json()) as PublicWasteCalendarResponse;
};
