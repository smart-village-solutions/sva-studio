import {
  buildWasteCalendarPdfDocument,
  renderWasteCalendarPdf,
  type WasteOutputPickupEntry,
} from '@sva/core';

import { loadNextPublicWasteSelection, loadResolvedPublicWasteCalendar } from './public-waste-api.js';
import { isPublicWasteStreetSelectionId, isPublicWasteUuid } from './public-waste-contract.js';
import { renderPublicWasteIcal } from './public-waste-ical.server.js';
import type { PublicWastePdfStaticConfig } from './public-waste-pdf-settings.server.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';

const INVALID_REQUEST_MESSAGE = 'Ungueltige Anfrage.';
const NO_PDF_ENTRIES_MESSAGE = 'Für diese Auswahl konnten keine PDF-Termine ermittelt werden.';

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

const readRequiredStreetParam = (url: URL, key: string): string => {
  const value = url.searchParams.get(key)?.trim();
  if (!value || !isPublicWasteStreetSelectionId(value)) {
    throw new Error(`missing_query_param:${key}`);
  }
  return value;
};

const readOptionalStreetParam = (url: URL, key: string): string | undefined => {
  const value = url.searchParams.get(key)?.trim();
  if (!value) {
    return undefined;
  }
  if (!isPublicWasteStreetSelectionId(value)) {
    throw new Error(`invalid_query_param:${key}`);
  }
  return value;
};

const readRequiredYear = (url: URL): number => {
  const value = Number.parseInt(url.searchParams.get('year') ?? '', 10);
  if (!Number.isInteger(value) || value < 2000 || value > 2100) {
    throw new Error('invalid_query_param:year');
  }
  return value;
};

const normalizeDateForIcal = (value: string): string => value.replaceAll('-', '');

const normalizePdfLocationLabel = (selectionSummary: string): string => {
  const parts = selectionSummary.split(',').map((part) => part.trim()).filter(Boolean);
  const city = parts[0] ?? '';
  const remainder = parts
    .slice(1)
    .join(', ')
    .replace(/\bAlle Hausnummern\b/giu, '')
    .replace(/\bAlle Straßen\b/giu, '')
    .replace(/\s+,/g, ',')
    .trim();
  return [city, remainder].filter(Boolean).join(', ');
};

const collectPdfNotes = (notes: readonly (string | null)[]): readonly string[] =>
  Array.from(new Set(notes.map((note) => note?.trim()).filter((note): note is string => Boolean(note)))).slice(0, 4);

const buildPdfPickups = (
  entries: readonly {
    readonly date: string;
    readonly fractionId: string;
    readonly fractionLabel: string;
    readonly fractionShortLabel?: string;
    readonly fractionColor?: string;
  }[]
): readonly WasteOutputPickupEntry[] => {
  const byDate = new Map<string, WasteOutputPickupEntry['fractions'][number][]>();

  for (const entry of entries) {
    const fractions = byDate.get(entry.date) ?? [];
    fractions.push({
      id: entry.fractionId,
      label: entry.fractionLabel,
      shortLabel: entry.fractionShortLabel,
      color: entry.fractionColor ?? '#808080',
    });
    byDate.set(entry.date, fractions);
  }

  return Array.from(byDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, fractions]) => ({
      date,
      fractions: [...fractions].sort((left, right) => left.label.localeCompare(right.label, 'de')),
    }));
};

const toPdfFilename = (year: number, locationLabel: string): string =>
  `abfallkalender-${year}-${locationLabel.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'standort'}.pdf`;

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
          streetId: readOptionalStreetParam(url, 'streetId'),
          houseNumberId: readOptionalParam(url, 'houseNumberId'),
        },
      },
    });

    return jsonResponse(payload);
  } catch {
    return jsonResponse({ error: 'invalid_request', message: INVALID_REQUEST_MESSAGE }, 400);
  }
};

export const handlePublicWasteCalendarRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries' | 'loadSelectionSummary'>;
  readonly request: Request;
}): Promise<Response> => {
  try {
    const url = new URL(input.request.url);
    const selection = {
      regionId: readOptionalParam(url, 'regionId'),
      cityId: readRequiredParam(url, 'cityId'),
      streetId: readRequiredStreetParam(url, 'streetId'),
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

    return jsonResponse({
      ...payload,
      selectionSummary,
      icalUrl: `/api/public-waste/ical?${new URLSearchParams({
        ...(selection.regionId ? { regionId: selection.regionId } : {}),
        cityId: selection.cityId,
        streetId: selection.streetId,
        ...(selection.houseNumberId ? { houseNumberId: selection.houseNumberId } : {}),
        calendarName: selectionSummary,
      }).toString()}`,
    });
  } catch {
    return jsonResponse({ error: 'invalid_request', message: INVALID_REQUEST_MESSAGE }, 400);
  }
};

export const handlePublicWastePdfRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries' | 'loadSelectionSummary'>;
  readonly request: Request;
  readonly loadPdfStaticConfig: () => Promise<PublicWastePdfStaticConfig>;
}): Promise<Response> => {
  try {
    const url = new URL(input.request.url);
    const selection = {
      regionId: readOptionalParam(url, 'regionId'),
      cityId: readRequiredParam(url, 'cityId'),
      streetId: readRequiredStreetParam(url, 'streetId'),
      houseNumberId: readOptionalParam(url, 'houseNumberId'),
    } as const;
    const year = readRequiredYear(url);
    const fractionIds = Array.from(
      new Set(url.searchParams.getAll('fractionId').map((value) => value.trim()).filter(Boolean))
    );
    if (fractionIds.length === 0) {
      throw new Error('missing_query_param:fractionId');
    }

    const [entries, selectionSummary, staticConfig] = await Promise.all([
      input.repository.loadCalendarEntries({
        selection,
        referenceDate: `${year}-01-01`,
      }),
      input.repository.loadSelectionSummary({ selection }),
      input.loadPdfStaticConfig(),
    ]);

    const filteredEntries = entries.filter(
      (entry) => entry.date.startsWith(`${year}-`) && fractionIds.includes(entry.fractionId)
    );
    if (filteredEntries.length === 0) {
      return new Response(NO_PDF_ENTRIES_MESSAGE, { status: 404 });
    }

    const locationLabel = normalizePdfLocationLabel(selectionSummary);
    const pdf = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year,
        locationLabel,
        pickups: buildPdfPickups(filteredEntries),
        notes: collectPdfNotes(filteredEntries.map((entry) => entry.note)),
        footerLine: staticConfig.contactBlock?.replace(/\s*\n\s*/g, ' · '),
        brandingPlaceholderLabel: staticConfig.brandingAssetUrl ? 'Branding-Grafik' : 'Kommunales Waste-Management',
      })
    );
    const pdfBody = new Blob([Uint8Array.from(pdf)], { type: 'application/pdf' });

    return new Response(pdfBody, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${toPdfFilename(year, locationLabel)}"`,
      },
    });
  } catch {
    return new Response(INVALID_REQUEST_MESSAGE, { status: 400 });
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
          streetId: readRequiredStreetParam(url, 'streetId'),
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
  } catch {
    return new Response(INVALID_REQUEST_MESSAGE, { status: 400 });
  }
};
