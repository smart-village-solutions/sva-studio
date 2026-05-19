import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicWasteIndexPage } from './index.js';

const selectionPayloads = {
  root: {
    status: 'incomplete',
    step: 'city',
    options: [
      { id: '11111111-1111-4111-8111-111111111111', label: 'Nauen' },
      { id: '22222222-2222-4222-8222-222222222222', label: 'Rathenow' },
    ],
  },
  city: {
    status: 'incomplete',
    step: 'street',
    options: [
      { id: '33333333-3333-4333-8333-333333333333', label: 'Am alten Hafen' },
      { id: '55555555-5555-4555-8555-555555555555', label: 'Berliner Straße' },
    ],
  },
  street: {
    status: 'incomplete',
    step: 'houseNumber',
    options: [
      { id: '44444444-4444-4444-8444-444444444444', label: '12' },
      { id: '66666666-6666-4666-8666-666666666666', label: '14' },
    ],
  },
  complete: {
    status: 'incomplete',
    step: 'houseNumber',
    options: [],
  },
} as const;

const calendarPayload = {
  locationKey:
    '~:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444',
  nextPickupDate: '2026-05-19',
  listEntries: [
    {
      id: 'pickup-1',
      date: '2026-05-19',
      fractionId: 'bio',
      fractionLabel: 'Bioabfall',
      fractionColor: '#00AA00',
      note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
    },
  ],
  monthBuckets: [{ month: '2026-05', entries: [] }],
  yearBuckets: [{ year: '2026', entries: [] }],
  fractionOptions: [{ id: 'bio', label: 'Bioabfall' }],
  selectionSummary: 'Rathenow, Am alten Hafen 12',
  pdfLinks: [
    'https://example.invalid/~:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444/2025.pdf',
    'https://example.invalid/~:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444/2026.pdf',
    'https://example.invalid/~:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444/2027.pdf',
  ],
  icalUrl:
    '/api/public-waste/ical?cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&houseNumberId=44444444-4444-4444-8444-444444444444&calendarName=Rathenow%2C+Am+alten+Hafen+12',
} as const;

describe('PublicWasteIndexPage', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    document.cookie = 'sva_public_waste_location=; Max-Age=0; Path=/';
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads selection and calendar data from the public api, stores the cookie, and restores it on the next render', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (
        url.includes('/api/public-waste/selection') &&
        url.includes('houseNumberId=44444444-4444-4444-8444-444444444444')
      ) {
        return new Response(JSON.stringify(selectionPayloads.complete), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (
        url.includes('/api/public-waste/selection') &&
        url.includes('streetId=33333333-3333-4333-8333-333333333333')
      ) {
        return new Response(JSON.stringify(selectionPayloads.street), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (
        url.includes('/api/public-waste/selection') &&
        url.includes('cityId=22222222-2222-4222-8222-222222222222')
      ) {
        return new Response(JSON.stringify(selectionPayloads.city), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/api/public-waste/selection')) {
        return new Response(JSON.stringify(selectionPayloads.root), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/api/public-waste/calendar')) {
        return new Response(JSON.stringify(calendarPayload), {
          headers: { 'content-type': 'application/json' },
        });
      }

      throw new Error(`unexpected fetch: ${url}`);
    });

    const { unmount } = render(<PublicWasteIndexPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Rathenow' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Rathenow' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Am alten Hafen' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Am alten Hafen' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '12' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '12' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'In Kalender übernehmen' })).toBeTruthy();
    });

    expect(document.cookie).toContain(
      'sva_public_waste_location=~%3A22222222-2222-4222-8222-222222222222%3A33333333-3333-4333-8333-333333333333%3A44444444-4444-4444-8444-444444444444'
    );
    expect(screen.getByText('Rathenow')).toBeTruthy();
    expect(screen.getByText('Am alten Hafen')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();

    unmount();
    render(<PublicWasteIndexPage />);

    await waitFor(() => {
      expect(screen.getByText('Rathenow')).toBeTruthy();
    });

    expect(screen.getByText('Rathenow')).toBeTruthy();
    expect(screen.getByText('Am alten Hafen')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'In Kalender übernehmen' })).toBeTruthy();
  });
});
