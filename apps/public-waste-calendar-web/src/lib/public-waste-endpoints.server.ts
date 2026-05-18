import { loadNextPublicWasteSelection, loadResolvedPublicWasteCalendar } from './public-waste-api.js';
import { renderPublicWasteIcal } from './public-waste-ical.server.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });

const readRequiredParam = (url: URL, key: string): string => {
  const value = url.searchParams.get(key)?.trim();
  if (!value) {
    throw new Error(`missing_query_param:${key}`);
  }
  return value;
};

const normalizeDateForIcal = (value: string): string => value.replaceAll('-', '');

export const handlePublicWasteSelectionRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'listSelectionOptions'>;
  readonly request: Request;
}): Promise<Response> => {
  const url = new URL(input.request.url);
  const payload = await loadNextPublicWasteSelection({
    repository: input.repository,
    input: {
      selection: {
        regionId: url.searchParams.get('regionId') ?? undefined,
        cityId: url.searchParams.get('cityId') ?? undefined,
        streetId: url.searchParams.get('streetId') ?? undefined,
        houseNumberId: url.searchParams.get('houseNumberId') ?? undefined,
      },
    },
  });

  return jsonResponse(payload);
};

export const handlePublicWasteCalendarRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries'>;
  readonly request: Request;
}): Promise<Response> => {
  const url = new URL(input.request.url);
  const payload = await loadResolvedPublicWasteCalendar({
    repository: input.repository,
    input: {
      selection: {
        regionId: readRequiredParam(url, 'regionId'),
        cityId: readRequiredParam(url, 'cityId'),
        streetId: readRequiredParam(url, 'streetId'),
        houseNumberId: readRequiredParam(url, 'houseNumberId'),
      },
      referenceDate: url.searchParams.get('referenceDate') ?? new Date().toISOString().slice(0, 10),
    },
  });

  return jsonResponse(payload);
};

export const handlePublicWasteIcalRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries'>;
  readonly request: Request;
}): Promise<Response> => {
  const url = new URL(input.request.url);
  const calendar = await loadResolvedPublicWasteCalendar({
    repository: input.repository,
    input: {
      selection: {
        regionId: readRequiredParam(url, 'regionId'),
        cityId: readRequiredParam(url, 'cityId'),
        streetId: readRequiredParam(url, 'streetId'),
        houseNumberId: readRequiredParam(url, 'houseNumberId'),
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
};
