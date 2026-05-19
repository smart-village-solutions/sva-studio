import { describe, expect, it, vi } from 'vitest';

import { loadInitialPublicWastePage } from './public-waste-page.server.js';

describe('public waste page server', () => {
  it('restores a valid stored location', async () => {
    const response = await loadInitialPublicWastePage({
      request: {
        headers: {
          get: (name: string) =>
            name === 'cookie'
              ? 'sva_public_waste_location=11111111-1111-4111-8111-111111111111%3A22222222-2222-4222-8222-222222222222%3A33333333-3333-4333-8333-333333333333%3A44444444-4444-4444-8444-444444444444'
              : null,
        },
      } as unknown as Request,
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
      referenceDate: '2026-05-18',
    });

    expect(response.selectionState).toBe('complete');
    if (response.selectionState !== 'complete') {
      throw new Error('expected complete response');
    }
    expect(response.locationKey).toBe(
      '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444'
    );
  });

  it('falls back to incomplete selection when no stored location exists', async () => {
    const response = await loadInitialPublicWastePage({
      request: {
        headers: {
          get: () => null,
        },
      } as unknown as Request,
      repository: {
        loadCalendarEntries: vi.fn(),
      },
      referenceDate: '2026-05-18',
    });

    expect(response.selectionState).toBe('incomplete');
  });

  it('falls back to incomplete selection when the stored location key is malformed', async () => {
    const response = await loadInitialPublicWastePage({
      request: {
        headers: {
          get: (name: string) => (name === 'cookie' ? 'sva_public_waste_location=r-1%3Ac-1%3As-1%3Ah-1' : null),
        },
      } as unknown as Request,
      repository: {
        loadCalendarEntries: vi.fn(),
      },
      referenceDate: '2026-05-18',
    });

    expect(response.selectionState).toBe('incomplete');
  });
});
