import { describe, expect, it, vi } from 'vitest';

import {
  handlePublicWasteCalendarRequest,
  handlePublicWasteIcalRequest,
  handlePublicWasteSelectionRequest,
} from './public-waste-endpoints.server.js';

describe('public waste endpoints', () => {
  it('returns the next selection step as json', async () => {
    const response = await handlePublicWasteSelectionRequest({
      repository: {
        listSelectionOptions: vi.fn().mockResolvedValue({
          step: 'city',
          options: [{ id: 'c-1', label: 'Musterstadt' }],
        }),
      },
      request: new Request('https://example.invalid/public-waste/selection?regionId=r-1'),
    });

    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      status: 'incomplete',
      step: 'city',
      options: [{ id: 'c-1', label: 'Musterstadt' }],
    });
  });

  it('returns the resolved calendar model as json', async () => {
    const response = await handlePublicWasteCalendarRequest({
      repository: {
        loadCalendarEntries: vi.fn().mockResolvedValue([
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            note: null,
          },
        ]),
      },
      request: new Request(
        'https://example.invalid/public-waste/calendar?regionId=r-1&cityId=c-1&streetId=s-1&houseNumberId=h-1&referenceDate=2026-05-18'
      ),
    });

    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      locationKey: 'r-1:c-1:s-1:h-1',
      nextPickupDate: '2026-05-19',
    });
  });

  it('returns an iCal feed for the resolved calendar request', async () => {
    const response = await handlePublicWasteIcalRequest({
      repository: {
        loadCalendarEntries: vi.fn().mockResolvedValue([
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
          },
        ]),
      },
      request: new Request(
        'https://example.invalid/public-waste/calendar.ics?regionId=r-1&cityId=c-1&streetId=s-1&houseNumberId=h-1&calendarName=Musterstadt'
      ),
    });

    expect(response.headers.get('content-type')).toContain('text/calendar');
    await expect(response.text()).resolves.toContain('SUMMARY:Bioabfall');
  });
});
