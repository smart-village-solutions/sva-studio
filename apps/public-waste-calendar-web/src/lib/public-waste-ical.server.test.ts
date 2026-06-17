import { describe, expect, it } from 'vitest';

import { renderPublicWasteIcal } from './public-waste-ical.server.js';

describe('public waste iCal', () => {
  it('renders a calendar feed for upcoming pickup entries', () => {
    const ical = renderPublicWasteIcal({
      calendarName: 'Abfallkalender Musterstadt',
      calendarDescription: 'Abholort: Musterstadt, Hauptstraße 1',
      events: [
        {
          uid: 'pickup-1@example.invalid',
          startDate: '20260519',
          summary: 'Bioabfall',
          description:
            'Fraktion: Bioabfall aus Küche und Garten\nTour: Regelabfuhr für die Innenstadt\nHinweis: Bitte Tonne ab 6 Uhr bereitstellen.',
        },
      ],
    });

    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('DESCRIPTION:Abholort: Musterstadt\\, Hauptstraße 1');
    expect(ical).toContain('X-WR-CALDESC:Abholort: Musterstadt\\, Hauptstraße 1');
    expect(ical).toContain(
      'DESCRIPTION:Fraktion: Bioabfall aus Küche und Garten\\nTour: Regelabfuhr für die Innenstadt\\nHinweis: Bitte Tonne ab 6 Uhr bereitstellen.'
    );
    expect(ical).toContain('SUMMARY:Bioabfall');
    expect(ical).toContain('DTSTART;VALUE=DATE:20260519');
  });

  it('normalizes carriage returns in calendar and event descriptions before escaping', () => {
    const ical = renderPublicWasteIcal({
      calendarName: 'Abfallkalender Musterstadt',
      calendarDescription: 'Abholort:\r\nMusterstadt\rHauptstraße 1',
      events: [
        {
          uid: 'pickup-1@example.invalid',
          startDate: '20260519',
          summary: 'Bioabfall',
          description: 'Fraktion: Bioabfall\r\nTour: Innenstadt\rHinweis: Bereitstellen',
        },
      ],
    });

    expect(ical).toContain('DESCRIPTION:Abholort:\\nMusterstadt\\nHauptstraße 1');
    expect(ical).toContain('X-WR-CALDESC:Abholort:\\nMusterstadt\\nHauptstraße 1');
    expect(ical).toContain('DESCRIPTION:Fraktion: Bioabfall\\nTour: Innenstadt\\nHinweis: Bereitstellen');
    expect(ical).not.toContain('\rHauptstraße 1');
    expect(ical).not.toContain('\rTour: Innenstadt');
  });

  it('renders optional display alarms for reminder-enabled events', () => {
    const ical = renderPublicWasteIcal({
      calendarName: 'Abfallkalender Musterstadt',
      events: [
        {
          uid: 'pickup-1@example.invalid',
          startDate: '20260519',
          summary: 'Bioabfall',
          alarms: [{ triggerDaysBefore: 2 }],
        },
      ],
    });

    expect(ical).toContain('BEGIN:VALARM');
    expect(ical).toContain('ACTION:DISPLAY');
    expect(ical).toContain('TRIGGER:-P2D');
    expect(ical).toContain('DESCRIPTION:Erinnerung: Bioabfall');
  });
});
