import { describe, expect, it } from 'vitest';

import { renderPublicWasteIcal } from './public-waste-ical.server.js';

describe('public waste iCal', () => {
  it('renders a calendar feed for upcoming pickup entries', () => {
    const ical = renderPublicWasteIcal({
      calendarName: 'Abfallkalender Musterstadt',
      events: [
        {
          uid: 'pickup-1@example.invalid',
          startDate: '20260519',
          summary: 'Bioabfall',
          description: 'Bitte Tonne ab 6 Uhr bereitstellen.',
        },
      ],
    });

    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('SUMMARY:Bioabfall');
    expect(ical).toContain('DTSTART;VALUE=DATE:20260519');
  });
});
