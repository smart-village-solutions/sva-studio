import { describe, expect, it, vi } from 'vitest';

import { loadInitialPublicWastePage } from './public-waste-page.server.js';

describe('public waste page server', () => {
  it('restores a valid stored location and exposes a user-facing notice', async () => {
    const response = await loadInitialPublicWastePage({
      request: {
        headers: {
          get: (name: string) =>
            name === 'cookie' ? 'sva_public_waste_location=r-1%3Ac-1%3As-1%3Ah-1' : null,
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
    expect(response.restoredLocationNotice).toContain('Adresse');
    expect(response.locationKey).toBe('r-1:c-1:s-1:h-1');
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
});
