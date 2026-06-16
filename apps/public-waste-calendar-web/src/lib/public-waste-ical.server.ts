export type PublicWasteIcalModel = {
  readonly calendarName: string;
  readonly calendarDescription?: string;
  readonly events: readonly {
    readonly uid: string;
    readonly startDate: string;
    readonly summary: string;
    readonly description?: string;
  }[];
};

const normalizeIcalText = (value: string): string => value.replaceAll('\r\n', '\n').replaceAll('\r', '\n');

const escapeIcalText = (value: string): string =>
  normalizeIcalText(value).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');

export const renderPublicWasteIcal = (input: PublicWasteIcalModel): string =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SVA Studio//Public Waste Calendar//DE',
    `X-WR-CALNAME:${escapeIcalText(input.calendarName)}`,
    ...(input.calendarDescription
      ? [
          `DESCRIPTION:${escapeIcalText(input.calendarDescription)}`,
          `X-WR-CALDESC:${escapeIcalText(input.calendarDescription)}`,
        ]
      : []),
    ...input.events.flatMap((event) => [
      'BEGIN:VEVENT',
      `UID:${escapeIcalText(event.uid)}`,
      `DTSTART;VALUE=DATE:${event.startDate}`,
      `SUMMARY:${escapeIcalText(event.summary)}`,
      ...(event.description ? [`DESCRIPTION:${escapeIcalText(event.description)}`] : []),
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].join('\r\n');
