import { act, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Root } from 'react-dom/client';
import { mountPublicWasteCalendar } from './embed.js';

const roots: Root[] = [];
afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots.length = 0;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('direct calendar embedding', () => {
  it('binds two widgets independently of the host path without consuming host preferences', async () => {
    window.history.replaceState({}, '', '/external/article?regionId=invalid');
    const readCookie = vi.spyOn(document, 'cookie', 'get');
    const writeCookie = vi.spyOn(document, 'cookie', 'set');
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            status: 'incomplete',
            step: 'city',
            options: [
              { id: 'city-a', label: 'Ort A' },
              { id: 'city-b', label: 'Ort B' },
            ],
          })
        )
    );
    vi.stubGlobal('fetch', fetchMock);
    const regions = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];
    for (const [index, region] of regions.entries()) {
      const container = document.createElement('div');
      container.dataset.region = region;
      document.body.append(container);
      await act(async () => {
        roots.push(mountPublicWasteCalendar(container, `https://calendar-${index}.example`));
      });
      await waitFor(() =>
        expect(
          within(container.shadowRoot?.lastElementChild as HTMLElement).getByRole('combobox', {
            name: 'Ort suchen',
          })
        ).toBeTruthy()
      );
    }
    expect(
      fetchMock.mock.calls.map(([value]) => {
        const url = new URL(value instanceof Request ? value.url : value);
        return [url.origin, url.searchParams.get('regionId')];
      })
    ).toEqual([
      ['https://calendar-0.example', regions[0]],
      ['https://calendar-1.example', regions[1]],
    ]);
    expect(window.location.pathname).toBe('/external/article');
    expect(document.querySelector('iframe')).toBeNull();
    expect(readCookie).not.toHaveBeenCalled();
    expect(writeCookie).not.toHaveBeenCalled();
  });

  it('fails closed on missing region rather than using host URL parameters', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const container = document.createElement('div');
    document.body.append(container);
    await act(async () => {
      roots.push(mountPublicWasteCalendar(container, 'https://calendar.example'));
    });
    await waitFor(() =>
      expect(
        within(container.shadowRoot?.lastElementChild as HTMLElement).getByRole('alert')
      ).toBeTruthy()
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-http API URLs before modifying the host element', () => {
    const container = document.createElement('div');
    expect(() => mountPublicWasteCalendar(container, 'javascript:alert(1)')).toThrow(
      'invalid_public_waste_api_origin'
    );
    expect(container.shadowRoot).toBeNull();
  });
});
