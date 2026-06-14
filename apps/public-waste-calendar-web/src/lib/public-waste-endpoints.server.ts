import {
  buildWasteCalendarPdfDocument,
  renderWasteCalendarPdf,
  type WasteManagementEmailReminderConfig,
  type WasteCalendarPdfBrandingImage,
  type WasteOutputPickupEntry,
} from '@sva/core';
import { PublicWasteReminderSignupError } from '../server/public-waste-email-reminders.server.js';

import { loadNextPublicWasteSelection, loadResolvedPublicWasteCalendar } from './public-waste-api.js';
import type {
  PublicWasteReminderSignupRequest,
  PublicWasteReminderSignupResponse,
} from './public-waste-contract.js';
import { renderPublicWasteIcal } from './public-waste-ical.server.js';
import type { PublicWastePdfStaticConfig } from './public-waste-pdf-settings.server.js';
import {
  readPublicWasteCalendarName,
  readPublicWasteFractionIds,
  readPublicWasteReferenceDate,
  readPublicWasteResolvedSelection,
  readPublicWasteSelectionState,
} from './public-waste-request-parsing.server.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';

const INVALID_REQUEST_MESSAGE = 'Ungültige Anfrage.';
const NO_PDF_ENTRIES_MESSAGE = 'Für diese Auswahl konnten keine PDF-Termine ermittelt werden.';
const REMINDER_SIGNUP_NOT_READY_MESSAGE = 'Der E-Mail-Erinnerungsdienst ist derzeit nicht verfügbar.';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });

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
  const byDate = new Map<string, Map<string, WasteOutputPickupEntry['fractions'][number]>>();

  for (const entry of entries) {
    const fractions = byDate.get(entry.date) ?? new Map<string, WasteOutputPickupEntry['fractions'][number]>();
    fractions.set(entry.fractionId, {
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
      fractions: Array.from(fractions.values()).sort((left, right) => left.label.localeCompare(right.label, 'de')),
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
        selection: readPublicWasteSelectionState(url),
      },
    });

    return jsonResponse(payload);
  } catch {
    return jsonResponse({ error: 'invalid_request', message: INVALID_REQUEST_MESSAGE }, 400);
  }
};

export const handlePublicWasteCalendarRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries' | 'loadSelectionSummary' | 'loadReminderSignupOptions'>;
  readonly request: Request;
  readonly reminderConfig?: WasteManagementEmailReminderConfig;
}): Promise<Response> => {
  try {
    const url = new URL(input.request.url);
    const selection = readPublicWasteResolvedSelection(url);
    const [payload, selectionSummary, reminderFractions] = await Promise.all([
      loadResolvedPublicWasteCalendar({
        repository: input.repository,
        input: {
          selection,
          referenceDate: readPublicWasteReferenceDate(url),
        },
      }),
      input.repository.loadSelectionSummary({ selection }),
      input.reminderConfig?.enabled && input.reminderConfig.publicSignupEnabled
        ? input.repository.loadReminderSignupOptions({ selection })
        : Promise.resolve([]),
    ]);

    return jsonResponse({
      ...payload,
      selectionSummary,
      ...(input.reminderConfig?.enabled && input.reminderConfig.publicSignupEnabled && reminderFractions.length > 0
        ? {
            reminderSignup: {
              enabled: true,
              consentLabel: input.reminderConfig.consentLabel,
              privacyPolicyUrl: input.reminderConfig.privacyPolicyUrl,
              fractions: reminderFractions,
            },
          }
        : {}),
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

const isPublicWasteReminderSignupRequest = (value: unknown): value is PublicWasteReminderSignupRequest => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.email !== 'string' || !EMAIL_PATTERN.test(record.email.trim())) {
    return false;
  }
  if (record.consentAccepted !== true || !Array.isArray(record.items) || record.items.length === 0) {
    return false;
  }
  if (!record.selection || typeof record.selection !== 'object' || Array.isArray(record.selection)) {
    return false;
  }

  return record.items.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }

    const next = item as Record<string, unknown>;
    return typeof next.fractionId === 'string' && next.fractionId.length > 0 && typeof next.slotId === 'string' && next.slotId.length > 0;
  });
};

export const handlePublicWasteReminderSignupRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadReminderSignupOptions' | 'loadSelectionSummary'>;
  readonly request: Request;
  readonly reminderConfig?: WasteManagementEmailReminderConfig;
  readonly submitReminderSignup?: (input: {
    readonly request: Request;
    readonly payload: PublicWasteReminderSignupRequest;
    readonly reminderConfig: WasteManagementEmailReminderConfig;
    readonly repository: Pick<PublicWasteRepository, 'loadSelectionSummary'>;
  }) => Promise<PublicWasteReminderSignupResponse>;
}): Promise<Response> => {
  try {
    if (!input.reminderConfig?.enabled || !input.reminderConfig.publicSignupEnabled) {
      return new Response(REMINDER_SIGNUP_NOT_READY_MESSAGE, { status: 404 });
    }

    const payload = (await input.request.json()) as unknown;
    if (!isPublicWasteReminderSignupRequest(payload)) {
      return new Response(INVALID_REQUEST_MESSAGE, { status: 400 });
    }

    const allowedFractions = await input.repository.loadReminderSignupOptions({
      selection: payload.selection,
    });
    const allowedFractionMap = new Map(allowedFractions.map((fraction) => [fraction.id, fraction]));
    const hasInvalidItem = payload.items.some((item) => {
      const fraction = allowedFractionMap.get(item.fractionId);
      return !fraction || !fraction.slots.some((slot) => slot.id === item.slotId);
    });

    if (hasInvalidItem) {
      return new Response(INVALID_REQUEST_MESSAGE, { status: 400 });
    }

    if (!input.submitReminderSignup) {
      return new Response(REMINDER_SIGNUP_NOT_READY_MESSAGE, { status: 501 });
    }

    return jsonResponse(
      await input.submitReminderSignup({
        request: input.request,
        payload,
        reminderConfig: input.reminderConfig,
        repository: input.repository,
      })
    );
  } catch (error) {
    if (error instanceof PublicWasteReminderSignupError) {
      return new Response(error.message, {
        status: error.status,
        headers: error.retryAfterSeconds
          ? {
              'retry-after': String(error.retryAfterSeconds),
            }
          : undefined,
      });
    }
    return new Response(INVALID_REQUEST_MESSAGE, { status: 400 });
  }
};

export const handlePublicWastePdfRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries' | 'loadSelectionSummary'>;
  readonly request: Request;
  readonly loadPdfStaticConfig: () => Promise<PublicWastePdfStaticConfig>;
  readonly loadBrandingImage?: (input: {
    readonly assetUrl: string;
    readonly requestUrl: string;
  }) => Promise<WasteCalendarPdfBrandingImage | undefined>;
}): Promise<Response> => {
  try {
    const url = new URL(input.request.url);
    const selection = readPublicWasteResolvedSelection(url);
    const year = readRequiredYear(url);
    const fractionIds = readPublicWasteFractionIds(url);
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
    const brandingImage = staticConfig.brandingAssetUrl
      ? await input.loadBrandingImage?.({
          assetUrl: staticConfig.brandingAssetUrl,
          requestUrl: input.request.url,
        })
      : undefined;
    const pdf = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year,
        locationLabel,
        pickups: buildPdfPickups(filteredEntries),
        notes: [],
        footerLine: staticConfig.contactBlock?.replace(/\s*\n\s*/g, ' · '),
        ...(brandingImage ? { brandingImage } : {}),
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
        selection: readPublicWasteResolvedSelection(url),
        referenceDate: readPublicWasteReferenceDate(url),
      },
    });

    const body = renderPublicWasteIcal({
      calendarName: readPublicWasteCalendarName(url),
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
