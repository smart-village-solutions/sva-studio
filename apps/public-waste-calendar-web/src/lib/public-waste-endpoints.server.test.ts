import { describe, expect, it, vi } from 'vitest';

import {
  handlePublicWasteCalendarRequest,
  handlePublicWasteIcalRequest,
  handlePublicWastePdfRequest,
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
    });

    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      nextPickupDate: '2026-05-19',
      selectionSummary: 'Musterstadt, Hauptstraße 1',
    });
  });

  it('returns a binary pdf for the resolved selection and chosen fractions', async () => {
    const loadBrandingImage = vi.fn().mockResolvedValue({
      width: 2,
      height: 1,
      rgbData: new Uint8Array([255, 255, 255, 0, 0, 0]),
    });
    const response = await handlePublicWastePdfRequest({
      repository: {
        loadCalendarEntries: vi.fn().mockResolvedValue([
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            fractionShortLabel: 'BIO',
            note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
          },
        ]),
        loadSelectionSummary: vi.fn().mockResolvedValue('Musterstadt, Hauptstraße 1'),
      },
      request: new Request(
        'https://example.invalid/public-waste/pdf?cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&houseNumberId=44444444-4444-4444-8444-444444444444&year=2026&fractionId=bio'
      ),
      loadPdfStaticConfig: vi.fn().mockResolvedValue({
        brandingAssetUrl: 'https://cdn.example/logo.svg',
        contactBlock: 'Abfallberatung 03395 / 1234',
      }),
      loadBrandingImage,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('abfallkalender-2026-musterstadt-hauptstra-e-1.pdf');
    const pdfText = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(pdfText).toContain('Abfallkalender 2026');
    expect(pdfText).toContain('/Subtype /Image');
    expect(loadBrandingImage).toHaveBeenCalledWith('https://cdn.example/logo.svg');
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

  it('accepts the catch-all street sentinel for resolved calendar requests', async () => {
    const loadCalendarEntries = vi.fn().mockResolvedValue([]);
    const loadSelectionSummary = vi.fn().mockResolvedValue('Musterstadt, Alle Straßen');

    const response = await handlePublicWasteCalendarRequest({
      repository: {
        loadCalendarEntries,
        loadSelectionSummary,
      },
      request: new Request(
        'https://example.invalid/public-waste/calendar?cityId=22222222-2222-4222-8222-222222222222&streetId=all&referenceDate=2026-05-18'
      ),
    });

    expect(response.status).toBe(200);
    expect(loadCalendarEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: expect.objectContaining({
          streetId: 'all',
        }),
      })
    );
  });

  it('returns a generic invalid_request payload for malformed selection queries', async () => {
    const response = await handlePublicWasteSelectionRequest({
      repository: {
        listSelectionOptions: vi.fn(),
      },
      request: new Request('https://example.invalid/public-waste/selection?regionId=not-a-uuid'),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
      message: 'Ungültige Anfrage.',
    });
  });
});
