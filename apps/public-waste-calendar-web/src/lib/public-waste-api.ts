import {
  buildPublicWasteLocationKey,
  type PublicWasteReminderSelectionItem,
  type PublicWasteCalendarReminderView,
  type PublicWasteReminderSignupRequest,
  type PublicWasteReminderSignupResponse,
  type PublicWasteReminderSignupView,
  type PublicWasteResolvedSelection,
  type PublicWasteSelectionState,
} from './public-waste-contract.js';
import { projectPublicWasteCalendar } from './public-waste-projection.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';

// Keep URL resolution instance-local; standalone calls retain their relative URLs.
export const resolvePublicWasteApiUrl = (path: string, apiOrigin = ''): string =>
  apiOrigin ? new URL(path, apiOrigin).href : path;

export const fetchPublicWasteApi = (
  path: string,
  apiOrigin = '',
  init?: RequestInit
): Promise<Response> => {
  const url = resolvePublicWasteApiUrl(path, apiOrigin);
  if (apiOrigin) return fetch(url, { ...init, credentials: 'omit' });
  return init ? fetch(url, init) : fetch(url);
};

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
  return {
    locationKey: buildPublicWasteLocationKey(input.input.selection),
    ...projectPublicWasteCalendar({
      referenceDate: input.input.referenceDate,
      entries,
    }),
  };
};

export type PublicWasteSelectionResponse = {
  readonly status: 'incomplete';
  readonly step: 'region' | 'city' | 'street' | 'houseNumber';
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
  }[];
};

export type PublicWasteCalendarResponse = Awaited<
  ReturnType<typeof loadResolvedPublicWasteCalendar>
> & {
  readonly selectionSummary: string;
  readonly icalUrl: string;
  readonly calendarReminderOptions?: PublicWasteCalendarReminderView;
  readonly reminderSignup?: PublicWasteReminderSignupView;
};

const toSearchParams = (selection: PublicWasteSelectionState): URLSearchParams => {
  const params = new URLSearchParams();
  if (selection.regionId) params.set('regionId', selection.regionId);
  if (selection.cityId) params.set('cityId', selection.cityId);
  if (selection.streetId) params.set('streetId', selection.streetId);
  if (selection.houseNumberId) params.set('houseNumberId', selection.houseNumberId);
  return params;
};

const appendFractionIds = (params: URLSearchParams, fractionIds: readonly string[]) => {
  for (const fractionId of fractionIds) {
    params.append('fractionId', fractionId);
  }
};

const appendReminderItems = (
  params: URLSearchParams,
  items: readonly PublicWasteReminderSelectionItem[]
) => {
  for (const item of items) {
    params.append('reminderItem', `${item.fractionId}|${item.slotId}`);
  }
};

export const buildPublicWasteIcalUrl = (
  input: {
    readonly selection: PublicWasteResolvedSelection;
    readonly calendarName: string;
    readonly fractionIds: readonly string[];
    readonly reminderItems?: readonly PublicWasteReminderSelectionItem[];
  },
  apiOrigin = ''
): string => {
  const params = toSearchParams(input.selection);
  params.set('calendarName', input.calendarName);
  appendFractionIds(params, input.fractionIds);
  appendReminderItems(params, input.reminderItems ?? []);
  return resolvePublicWasteApiUrl(`/api/public-waste/ical?${params.toString()}`, apiOrigin);
};

export const buildPublicWastePdfDownloadUrl = (
  input: {
    readonly selection: PublicWasteResolvedSelection;
    readonly year: number;
    readonly fractionIds: readonly string[];
  },
  apiOrigin = ''
): string => {
  const params = toSearchParams(input.selection);
  params.set('year', String(input.year));
  appendFractionIds(params, input.fractionIds);
  return resolvePublicWasteApiUrl(`/api/public-waste/pdf?${params.toString()}`, apiOrigin);
};

export const requestPublicWasteSelection = async (
  selection: PublicWasteSelectionState,
  apiOrigin = ''
): Promise<PublicWasteSelectionResponse> => {
  const response = await fetchPublicWasteApi(
    `/api/public-waste/selection?${toSearchParams(selection).toString()}`,
    apiOrigin
  );
  if (!response.ok) {
    throw new Error(`public_waste_selection_failed:${response.status}`);
  }
  return (await response.json()) as PublicWasteSelectionResponse;
};

export const requestPublicWasteCalendar = async (
  input: {
    readonly selection: PublicWasteResolvedSelection;
    readonly referenceDate: string;
  },
  apiOrigin = ''
): Promise<PublicWasteCalendarResponse> => {
  const params = toSearchParams(input.selection);
  params.set('referenceDate', input.referenceDate);
  const response = await fetchPublicWasteApi(
    `/api/public-waste/calendar?${params.toString()}`,
    apiOrigin
  );
  if (!response.ok) {
    throw new Error(`public_waste_calendar_failed:${response.status}`);
  }
  return (await response.json()) as PublicWasteCalendarResponse;
};

export const requestPublicWastePdf = async (
  input: {
    readonly selection: PublicWasteResolvedSelection;
    readonly year: number;
    readonly fractionIds: readonly string[];
  },
  apiOrigin = ''
): Promise<{ readonly blob: Blob; readonly filename: string }> => {
  const response = await fetchPublicWasteApi(buildPublicWastePdfDownloadUrl(input), apiOrigin, {
    headers: {
      accept: 'application/pdf, application/json;q=0.9, text/plain;q=0.8',
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `public_waste_pdf_failed:${response.status}`);
  }

  const contentDisposition = response.headers.get('content-disposition') ?? '';
  const filenameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);

  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] ?? `abfallkalender-${input.year}.pdf`,
  };
};

export const requestPublicWasteReminderSignup = async (
  input: PublicWasteReminderSignupRequest,
  apiOrigin = ''
): Promise<PublicWasteReminderSignupResponse> => {
  const response = await fetchPublicWasteApi('/api/public-waste/reminder-signups', apiOrigin, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `public_waste_reminder_signup_failed:${response.status}`);
  }

  return (await response.json()) as PublicWasteReminderSignupResponse;
};
