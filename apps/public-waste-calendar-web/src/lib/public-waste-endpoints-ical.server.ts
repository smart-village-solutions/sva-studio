import { convertRichTextHtmlToPlainText } from '@sva/core';
import { loadResolvedPublicWasteCalendar } from './public-waste-api.js';
import { renderPublicWasteIcal } from './public-waste-ical.server.js';
import {
  readPublicWasteCalendarName,
  readPublicWasteFractionIds,
  readPublicWasteReminderItems,
  readPublicWasteReferenceDate,
  readPublicWasteResolvedSelection,
} from './public-waste-request-parsing.server.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';
import { INVALID_REQUEST_MESSAGE } from './public-waste-endpoints-shared.server.js';

const normalizeDateForIcal = (value: string): string => value.replaceAll('-', '');

const normalizeEventDescriptionPart = (value: string | undefined | null): string | null => {
  const normalized = value ? convertRichTextHtmlToPlainText(value) : '';
  return normalized ? normalized : null;
};

const filterCalendarEntriesByFractionIds = <
  TEntry extends {
    readonly fractionId: string;
  },
>(
  entries: readonly TEntry[],
  fractionIds: readonly string[]
): readonly TEntry[] => {
  if (fractionIds.length === 0) {
    return entries;
  }

  const allowedFractionIds = new Set(fractionIds);
  return entries.filter((entry) => allowedFractionIds.has(entry.fractionId));
};

const buildPublicWasteIcalEventDescription = (entry: {
  readonly fractionDescription?: string;
  readonly tourDescription?: string;
  readonly note: string | null;
}): string | undefined => {
  const uniqueValues = new Set<string>();
  const parts: string[] = [];
  const candidates = [
    ['Fraktion', normalizeEventDescriptionPart(entry.fractionDescription)] as const,
    ['Tour', normalizeEventDescriptionPart(entry.tourDescription)] as const,
    ['Hinweis', normalizeEventDescriptionPart(entry.note)] as const,
  ];

  for (const [label, value] of candidates) {
    if (!value || uniqueValues.has(value)) {
      continue;
    }

    uniqueValues.add(value);
    parts.push(`${label}: ${value}`);
  }

  return parts.length > 0 ? parts.join('\n') : undefined;
};

export const handlePublicWasteIcalRequest = async (input: {
  readonly repository: Pick<
    PublicWasteRepository,
    'loadCalendarEntries' | 'loadSelectionSummary' | 'loadReminderOptions'
  >;
  readonly request: Request;
}): Promise<Response> => {
  try {
    const url = new URL(input.request.url);
    const selection = readPublicWasteResolvedSelection(url);
    const fractionIds = readPublicWasteFractionIds(url);
    const reminderItems = readPublicWasteReminderItems(url);
    const [calendar, selectionSummary, calendarReminderFractions] = await Promise.all([
      loadResolvedPublicWasteCalendar({
        repository: input.repository,
        input: {
          selection,
          referenceDate: readPublicWasteReferenceDate(url),
        },
      }),
      input.repository.loadSelectionSummary({ selection }),
      reminderItems.length > 0
        ? input.repository.loadReminderOptions({ selection, channel: 'calendar' })
        : Promise.resolve([]),
    ]);
    const filteredEntries = filterCalendarEntriesByFractionIds(calendar.listEntries, fractionIds);
    const allowedReminderSlots = new Map(
      calendarReminderFractions.map((fraction) => [
        fraction.id,
        new Map(fraction.slots.map((slot) => [slot.id, slot])),
      ])
    );
    const reminderSlotSelections = new Map<string, { readonly defaultLeadDays: number }>();
    for (const item of reminderItems) {
      const slot = allowedReminderSlots.get(item.fractionId)?.get(item.slotId);
      if (!slot) {
        throw new Error('invalid_query_param:reminderItem');
      }

      reminderSlotSelections.set(item.fractionId, slot);
    }

    const body = renderPublicWasteIcal({
      calendarName: readPublicWasteCalendarName(url),
      calendarDescription: `Abholort: ${selectionSummary}`,
      events: filteredEntries.map((entry) => {
        const description = buildPublicWasteIcalEventDescription(entry);
        const reminderSlot = reminderSlotSelections.get(entry.fractionId);
        return {
          uid: `${entry.id}@public-waste-calendar`,
          startDate: normalizeDateForIcal(entry.date),
          summary: entry.fractionLabel,
          ...(description ? { description } : {}),
          ...(reminderSlot
            ? {
                alarms: [
                  {
                    triggerDaysBefore: reminderSlot.defaultLeadDays,
                  },
                ],
              }
            : {}),
        };
      }),
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
