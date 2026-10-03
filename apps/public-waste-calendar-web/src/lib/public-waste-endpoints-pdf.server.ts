import {
  buildWasteCalendarPdfDocument,
  type WasteCalendarPdfBrandingImage,
  type WasteOutputLegendHint,
  type WasteOutputPickupEntry,
} from '@sva/waste-management-contracts';
import { renderWasteCalendarPdf } from '@sva/waste-management-contracts/pdf';
import type { PublicWasteCalendarEntry } from './public-waste-contract.js';
import type { PublicWastePdfStaticConfig } from './public-waste-pdf-settings.server.js';
import {
  readPublicWasteFractionIds,
  readPublicWasteResolvedSelection,
} from './public-waste-request-parsing.server.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';
import { INVALID_REQUEST_MESSAGE } from './public-waste-endpoints-shared.server.js';

const NO_PDF_ENTRIES_MESSAGE = 'Für diese Auswahl konnten keine PDF-Termine ermittelt werden.';

const readRequiredYear = (url: URL): number => {
  const value = Number.parseInt(url.searchParams.get('year') ?? '', 10);
  if (!Number.isInteger(value) || value < 2000 || value > 2100) {
    throw new Error('invalid_query_param:year');
  }
  return value;
};

const normalizePdfLocationLabel = (selectionSummary: string): string => {
  const parts = selectionSummary
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
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

const formatPdfLegendDate = (value: string): string =>
  `${value.slice(8, 10)}.${value.slice(5, 7)}.`;

const buildPdfLegendHints = (
  entries: readonly PublicWasteCalendarEntry[]
): readonly WasteOutputLegendHint[] => {
  const tourHints = new Map<string, WasteOutputLegendHint>();
  const pickupHints = new Map<string, WasteOutputLegendHint>();

  for (const entry of entries) {
    const tourName = entry.tourName?.trim();
    const tourDescription = entry.tourDescription?.trim();
    if (tourName && tourDescription) {
      const id = `tour:${tourName}:${tourDescription}`;
      tourHints.set(id, { id, label: `Tour: ${tourName}`, description: tourDescription });
    }

    const note = entry.note?.trim();
    if (note) {
      const contextLabel = tourName ? `Tour: ${tourName}` : entry.fractionLabel;
      const id = `pickup:${entry.date}:${contextLabel}:${note}`;
      pickupHints.set(id, {
        id,
        label: `${formatPdfLegendDate(entry.date)} ${contextLabel}`,
        description: note,
      });
    }
  }

  return [...tourHints.values(), ...pickupHints.values()];
};

const buildPdfPickups = (
  entries: readonly {
    readonly date: string;
    readonly fractionId: string;
    readonly fractionLabel: string;
    readonly fractionDescription?: string;
    readonly fractionShortLabel?: string;
    readonly fractionColor?: string;
    readonly isShifted?: boolean;
  }[]
): readonly WasteOutputPickupEntry[] => {
  const byDate = new Map<string, Map<string, WasteOutputPickupEntry['fractions'][number]>>();

  for (const entry of entries) {
    const fractions =
      byDate.get(entry.date) ?? new Map<string, WasteOutputPickupEntry['fractions'][number]>();
    const existingFraction = fractions.get(entry.fractionId);
    fractions.set(entry.fractionId, {
      id: entry.fractionId,
      label: entry.fractionLabel,
      ...(existingFraction?.description || entry.fractionDescription?.trim()
        ? { description: existingFraction?.description ?? entry.fractionDescription?.trim() }
        : {}),
      shortLabel: entry.fractionShortLabel,
      color: entry.fractionColor ?? '#808080',
      ...(existingFraction?.isShifted || entry.isShifted ? { isShifted: true } : {}),
    });
    byDate.set(entry.date, fractions);
  }

  return Array.from(byDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, fractions]) => ({
      date,
      fractions: Array.from(fractions.values()).sort((left, right) =>
        left.label.localeCompare(right.label, 'de')
      ),
    }));
};

const toPdfFilename = (year: number, locationLabel: string): string =>
  `abfallkalender-${year}-${
    locationLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'standort'
  }.pdf`;

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
        ...(staticConfig.contactBlock ? { contactBlock: staticConfig.contactBlock } : {}),
        pickups: buildPdfPickups(filteredEntries),
        legendHints: buildPdfLegendHints(filteredEntries),
        ...(brandingImage ? { brandingImage } : {}),
        brandingPlaceholderLabel: staticConfig.brandingAssetUrl
          ? 'Branding-Grafik'
          : 'Kommunales Waste-Management',
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
