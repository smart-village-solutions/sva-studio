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
      request: new Request(
        'https://example.invalid/public-waste/selection?regionId=11111111-1111-4111-8111-111111111111'
      ),
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
        loadSelectionSummary: vi.fn().mockResolvedValue('Musterstadt, Hauptstraße 1'),
      },
      request: new Request(
        'https://example.invalid/public-waste/calendar?regionId=11111111-1111-4111-8111-111111111111&cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&houseNumberId=44444444-4444-4444-8444-444444444444&referenceDate=2026-05-18'
      ),
      pdfUrlTemplate: 'https://example.invalid/{locationKey}/{year}.pdf',
    });

    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      locationKey:
        '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444',
      nextPickupDate: '2026-05-19',
      selectionSummary: 'Musterstadt, Hauptstraße 1',
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
        'https://example.invalid/public-waste/calendar.ics?regionId=11111111-1111-4111-8111-111111111111&cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&houseNumberId=44444444-4444-4444-8444-444444444444&calendarName=Musterstadt'
      ),
    });

    expect(response.headers.get('content-type')).toContain('text/calendar');
    await expect(response.text()).resolves.toContain('SUMMARY:Bioabfall');
  });
});
