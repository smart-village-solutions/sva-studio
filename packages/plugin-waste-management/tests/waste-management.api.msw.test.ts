// @vitest-environment node

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { createWasteManagementCollectionLocation } from '../src/waste-management.api.js';

const server = setupServer();

describe('waste-management api client with shared MSW foundation', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllGlobals();
  });

  it('posts collection locations through the host facade using the shared MSW setup path', async () => {
    let requestBody: unknown;
    const nativeFetch = globalThis.fetch.bind(globalThis);

    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' && input.startsWith('/') ? new URL(input, 'http://localhost').toString() : input;
      return nativeFetch(url, init);
    });

    server.use(
      http.post('http://localhost/api/v1/waste-management/collection-locations', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          data: {
            id: 'location-1',
            regionId: 'region-1',
            cityId: 'city-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
            createdAt: '2026-05-22T10:00:00.000Z',
            updatedAt: '2026-05-22T10:00:00.000Z',
          },
        });
      })
    );

    const response = await createWasteManagementCollectionLocation({
      id: 'location-1',
      regionId: 'region-1',
      cityId: 'city-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
    });

    expect(requestBody).toEqual({
      id: 'location-1',
      regionId: 'region-1',
      cityId: 'city-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
    });
    expect(response).toMatchObject({
      id: 'location-1',
      cityId: 'city-1',
      active: true,
    });
  });
});
