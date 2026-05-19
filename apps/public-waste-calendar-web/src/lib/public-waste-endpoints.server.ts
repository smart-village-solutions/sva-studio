import { loadNextPublicWasteSelection, loadResolvedPublicWasteCalendar } from './public-waste-api.js';
import { buildPublicWastePdfLinks } from './public-waste-api.js';
import { isPublicWasteUuid } from './public-waste-contract.js';
import { renderPublicWasteIcal } from './public-waste-ical.server.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';

const INVALID_REQUEST_MESSAGE = 'Ungueltige Anfrage.';

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });

const readRequiredParam = (url: URL, key: string): string => {
  const value = url.searchParams.get(key)?.trim();
  if (!value || !isPublicWasteUuid(value)) {
    throw new Error(`missing_query_param:${key}`);
  }
  return value;
};

const readOptionalParam = (url: URL, key: string): string | undefined => {
  const value = url.searchParams.get(key)?.trim();
  if (!value) {
    return undefined;
  }
  if (!isPublicWasteUuid(value)) {
    throw new Error(`invalid_query_param:${key}`);
  }
  return value;
};

const normalizeDateForIcal = (value: string): string => value.replaceAll('-', '');

export const handlePublicWasteSelectionRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'listSelectionOptions'>;
  readonly request: Request;
}): Promise<Response> => {
  try {
    const url = new URL(input.request.url);
    const payload = await loadNextPublicWasteSelection({
      repository: input.repository,
      input: {
        selection: {
          regionId: readOptionalParam(url, 'regionId'),
          cityId: readOptionalParam(url, 'cityId'),
          streetId: readOptionalParam(url, 'streetId'),
          houseNumberId: readOptionalParam(url, 'houseNumberId'),
        },
      },
    });

    return jsonResponse(payload);
  } catch (error) {
    return jsonResponse({ error: 'invalid_request', message: INVALID_REQUEST_MESSAGE }, 400);
  }
};

export const handlePublicWasteCalendarRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries' | 'loadSelectionSummary'>;
  readonly request: Request;
  readonly pdfUrlTemplate: string;
}): Promise<Response> => {
  try {
    const url = new URL(input.request.url);
    const selection = {
      regionId: readOptionalParam(url, 'regionId'),
      cityId: readRequiredParam(url, 'cityId'),
      streetId: readRequiredParam(url, 'streetId'),
      houseNumberId: readOptionalParam(url, 'houseNumberId'),
    } as const;
    const payload = await loadResolvedPublicWasteCalendar({
      repository: input.repository,
      input: {
        selection,
        referenceDate: url.searchParams.get('referenceDate') ?? new Date().toISOString().slice(0, 10),
      },
    });

    const selectionSummary = await input.repository.loadSelectionSummary({ selection });
    const referenceYear = Number((url.searchParams.get('referenceDate') ?? new Date().toISOString().slice(0, 10)).slice(0, 4));

    return jsonResponse({
      ...payload,
      selectionSummary,
      pdfLinks: buildPublicWastePdfLinks({
        urlTemplate: input.pdfUrlTemplate,
        locationKey: payload.locationKey,
        year: referenceYear,
      }),
      icalUrl: `/api/public-waste/ical?${new URLSearchParams({
        ...(selection.regionId ? { regionId: selection.regionId } : {}),
        cityId: selection.cityId,
        streetId: selection.streetId,
        ...(selection.houseNumberId ? { houseNumberId: selection.houseNumberId } : {}),
        calendarName: selectionSummary,
      }).toString()}`,
    });
  } catch (error) {
    return jsonResponse({ error: 'invalid_request', message: INVALID_REQUEST_MESSAGE }, 400);
  }
};

export const handlePublicWasteIcalRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries'>;
  readonly request: Request;
}): Promise<Response> => {
  try {
    const url = new URL(input.request.url);
    const calendar = await loadResolvedPublicWasteCalendar({
      repository: input.repository,
      input: {
        selection: {
          regionId: readOptionalParam(url, 'regionId'),
          cityId: readRequiredParam(url, 'cityId'),
          streetId: readRequiredParam(url, 'streetId'),
          houseNumberId: readOptionalParam(url, 'houseNumberId'),
        },
        referenceDate: url.searchParams.get('referenceDate') ?? new Date().toISOString().slice(0, 10),
      },
    });

    const body = renderPublicWasteIcal({
      calendarName: url.searchParams.get('calendarName') ?? 'Abfallkalender',
      events: calendar.listEntries.map((entry) => ({
        uid: `${entry.id}@public-waste-calendar`,
        startDate: normalizeDateForIcal(entry.date),
        summary: entry.fractionLabel,
        ...(entry.note ? { description: entry.note } : {}),
      })),
    });

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
      },
    });
  } catch (error) {
    return new Response(INVALID_REQUEST_MESSAGE, { status: 400 });
  }
};
