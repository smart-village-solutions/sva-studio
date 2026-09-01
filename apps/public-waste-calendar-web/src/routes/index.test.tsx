import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicWasteIndexPage, readPublicWasteRegionBinding } from './index.js';

const BOUND_REGION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_REGION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

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
  icalUrl:
    '/api/public-waste/ical?cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&houseNumberId=44444444-4444-4444-8444-444444444444&calendarName=Rathenow%2C+Am+alten+Hafen+12',
} as const;

const calendarPayloadWithReminderSignup = {
  ...calendarPayload,
  reminderSignup: {
    enabled: true,
    consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
    privacyPolicyUrl: 'https://example.invalid/datenschutz',
    fractions: [
      {
        id: 'bio',
        label: 'Bioabfall',
        color: '#00AA00',
        slots: [{ id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 }],
      },
    ],
  },
} as const;

describe('PublicWasteIndexPage', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    document.cookie = 'sva_public_waste_location=; Max-Age=0; Path=/';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses exactly one valid URL region and rejects malformed or ambiguous bindings', () => {
    expect(readPublicWasteRegionBinding('')).toEqual({ status: 'unbound' });
    expect(readPublicWasteRegionBinding(`?regionId=${BOUND_REGION_ID}`)).toEqual({
      status: 'bound',
      regionId: BOUND_REGION_ID,
    });
    expect(readPublicWasteRegionBinding(`?regionId=${BOUND_REGION_ID.toUpperCase()}`)).toEqual({
      status: 'bound',
      regionId: BOUND_REGION_ID,
    });
    expect(readPublicWasteRegionBinding('?regionId=not-a-uuid')).toEqual({ status: 'invalid' });
    expect(
      readPublicWasteRegionBinding(`?regionId=${BOUND_REGION_ID}&regionId=${OTHER_REGION_ID}`)
    ).toEqual({ status: 'invalid' });
  });

  it('keeps a valid URL region across a conflicting cookie and address reset', async () => {
    window.history.replaceState({}, '', `/?regionId=${BOUND_REGION_ID}`);
    document.cookie = `sva_public_waste_location=${encodeURIComponent(
      `${OTHER_REGION_ID}:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444`
    )}; Path=/`;

    fetchMock.mockImplementation(async (input) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
        window.location.origin
      );

      if (url.pathname === '/api/public-waste/selection') {
        expect(url.searchParams.get('regionId')).toBe(BOUND_REGION_ID);
        if (url.searchParams.has('houseNumberId')) {
          return new Response(JSON.stringify(selectionPayloads.complete));
        }
        if (url.searchParams.has('streetId')) {
          return new Response(JSON.stringify(selectionPayloads.street));
        }
        if (url.searchParams.has('cityId')) {
          return new Response(JSON.stringify(selectionPayloads.city));
        }
        return new Response(JSON.stringify(selectionPayloads.root));
      }

      if (url.pathname === '/api/public-waste/calendar') {
        expect(url.searchParams.get('regionId')).toBe(BOUND_REGION_ID);
        return new Response(
          JSON.stringify({
            ...calendarPayload,
            locationKey: `${BOUND_REGION_ID}:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444`,
            icalUrl: `/api/public-waste/ical?regionId=${BOUND_REGION_ID}`,
          })
        );
      }

      throw new Error(`unexpected fetch: ${url.toString()}`);
    });

    render(<PublicWasteIndexPage />);

    expect(await screen.findByRole('combobox', { name: 'Ort suchen' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Region suchen' })).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Ort suchen' }), {
      target: { value: 'Rat' },
    });
    fireEvent.click(await screen.findByRole('option', { name: 'Rathenow' }));
    fireEvent.change(await screen.findByRole('combobox', { name: 'Straße suchen' }), {
      target: { value: 'Hafen' },
    });
    fireEvent.click(await screen.findByRole('option', { name: 'Am alten Hafen' }));
    fireEvent.change(await screen.findByRole('combobox', { name: 'Hausnummer suchen' }), {
      target: { value: '12' },
    });
    fireEvent.click(await screen.findByRole('option', { name: '12' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Adresse ändern' }));

    expect(await screen.findByRole('combobox', { name: 'Ort suchen' })).toBeTruthy();
    expect(screen.queryByText('Region')).toBeNull();
    expect(
      fetchMock.mock.calls.every(([input]) => {
        const url = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
          window.location.origin
        );
        return (
          !url.pathname.startsWith('/api/public-waste/') ||
          url.searchParams.get('regionId') === BOUND_REGION_ID
        );
      })
    ).toBe(true);
  });

  it('shows a fail-closed error for malformed and unknown URL regions', async () => {
    window.history.replaceState({}, '', '/?regionId=not-a-uuid');
    const { unmount } = render(<PublicWasteIndexPage />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Die angegebene Region ist ungültig'
    );
    expect(fetchMock).not.toHaveBeenCalled();

    unmount();
    window.history.replaceState({}, '', `/?regionId=${BOUND_REGION_ID}`);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'incomplete', step: 'city', options: [] }))
    );
    render(<PublicWasteIndexPage />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Die angegebene Region ist ungültig'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts a regionless stored location for a bound region and fails closed if that region disappears', async () => {
    window.history.replaceState({}, '', `/?regionId=${BOUND_REGION_ID}`);
    document.cookie =
      'sva_public_waste_location=~%3A22222222-2222-4222-8222-222222222222%3A33333333-3333-4333-8333-333333333333%3A44444444-4444-4444-8444-444444444444; Path=/';

    fetchMock.mockImplementation(async (input) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
        window.location.origin
      );

      expect(url.searchParams.get('regionId')).toBe(BOUND_REGION_ID);
      if (!url.searchParams.has('cityId')) {
        return new Response(JSON.stringify(selectionPayloads.root));
      }
      if (!url.searchParams.has('streetId')) {
        return new Response(JSON.stringify(selectionPayloads.city));
      }
      return new Response(JSON.stringify({ status: 'incomplete', step: 'city', options: [] }));
    });

    render(<PublicWasteIndexPage />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Die angegebene Region ist ungültig'
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
          window.location.origin
        );
        return url.pathname === '/api/public-waste/calendar';
      })
    ).toBe(false);
  });

  it('preserves the bound-region error after a selection interaction', async () => {
    window.history.replaceState({}, '', `/?regionId=${BOUND_REGION_ID}`);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(selectionPayloads.root)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'incomplete', step: 'city', options: [] }))
      );

    render(<PublicWasteIndexPage />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Ort suchen' }), {
      target: { value: 'Rat' },
    });
    fireEvent.click(await screen.findByRole('option', { name: 'Rathenow' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Die angegebene Region ist ungültig'
    );
  });

  it('loads selection and calendar data from the public api, stores the cookie, and restores it on the next render', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

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
    await act(async () => {});

    fireEvent.change(await screen.findByRole('combobox', { name: 'Ort suchen' }), {
      target: { value: 'Rat' },
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Rathenow' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('option', { name: 'Rathenow' }));
    await act(async () => {});
    fireEvent.change(await screen.findByRole('combobox', { name: 'Straße suchen' }), {
      target: { value: 'Hafen' },
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Am alten Hafen' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('option', { name: 'Am alten Hafen' }));
    await act(async () => {});
    fireEvent.change(await screen.findByRole('combobox', { name: 'Hausnummer suchen' }), {
      target: { value: '12' },
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: '12' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('option', { name: '12' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kalender exportieren' })).toBeTruthy();
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
    expect(screen.getByRole('button', { name: 'Kalender exportieren' })).toBeTruthy();
  });

  it('clears stale stored selections and falls back to the next valid selection step', async () => {
    document.cookie =
      'sva_public_waste_location=~%3A22222222-2222-4222-8222-222222222222%3A33333333-3333-4333-8333-333333333333%3A44444444-4444-4444-8444-444444444444; Path=/';

    fetchMock.mockImplementation(async (input) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (
        url.includes('/api/public-waste/selection') &&
        url.includes('cityId=22222222-2222-4222-8222-222222222222')
      ) {
        return new Response(
          JSON.stringify({
            status: 'incomplete',
            step: 'street',
            options: [
              { id: '55555555-5555-4555-8555-555555555555', label: 'Berliner Straße' },
              { id: '77777777-7777-4777-8777-777777777777', label: 'Märkische Allee' },
            ],
          }),
          { headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.includes('/api/public-waste/selection')) {
        return new Response(JSON.stringify(selectionPayloads.root), {
          headers: { 'content-type': 'application/json' },
        });
      }

      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<PublicWasteIndexPage />);
    await act(async () => {});

    fireEvent.change(await screen.findByRole('combobox', { name: 'Straße suchen' }), {
      target: { value: 'Ber' },
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Berliner Straße' })).toBeTruthy();
    });

    expect(document.cookie).toBe('');
    expect(document.cookie).not.toContain(
      '~%3A22222222-2222-4222-8222-222222222222%3A33333333-3333-4333-8333-333333333333%3A44444444-4444-4444-8444-444444444444'
    );
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        return url.includes('/api/public-waste/calendar');
      })
    ).toBe(false);
  });

  it('renders the public reminder signup when the calendar response provides it', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

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
        return new Response(JSON.stringify(calendarPayloadWithReminderSignup), {
          headers: { 'content-type': 'application/json' },
        });
      }

      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<PublicWasteIndexPage />);
    await act(async () => {});

    fireEvent.change(await screen.findByRole('combobox', { name: 'Ort suchen' }), {
      target: { value: 'Rat' },
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Rathenow' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Rathenow' }));
    await act(async () => {});

    fireEvent.change(await screen.findByRole('combobox', { name: 'Straße suchen' }), {
      target: { value: 'Hafen' },
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Am alten Hafen' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Am alten Hafen' }));
    await act(async () => {});

    fireEvent.change(await screen.findByRole('combobox', { name: 'Hausnummer suchen' }), {
      target: { value: '12' },
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: '12' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: '12' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'E-Mail-Erinnerung' })).toBeTruthy();
    });
  });
});
