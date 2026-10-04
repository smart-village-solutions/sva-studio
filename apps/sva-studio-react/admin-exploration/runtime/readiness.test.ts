import { describe, expect, it, vi } from 'vitest';

import { assertAdminExplorationReadiness } from './readiness.ts';

describe('assertAdminExplorationReadiness', () => {
  it('returns the checked url and status for reachable targets and requests html explicitly', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html><body>ready</body></html>', { status: 200 }));

    await expect(assertAdminExplorationReadiness('https://studio.example.test', fetchImpl)).resolves.toEqual({
      checkedUrl: 'https://studio.example.test',
      httpStatus: 200,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://studio.example.test',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
        headers: {
          accept: 'text/html,application/xhtml+xml',
        },
      })
    );
  });

  it('wraps fetch errors with the target url', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('fetch failed');
    });

    await expect(assertAdminExplorationReadiness('https://studio.example.test', fetchImpl)).rejects.toThrow(
      'AdminExploration admin target is not reachable: https://studio.example.test. fetch failed'
    );
  });

  it('falls back to a stable message for non-Error throwables', async () => {
    const fetchImpl = vi.fn(async () => {
      throw 'boom';
    });

    await expect(assertAdminExplorationReadiness('https://studio.example.test', fetchImpl)).rejects.toThrow(
      'AdminExploration admin target is not reachable: https://studio.example.test. Unknown readiness error'
    );
  });

  it('rejects 404 responses as unusable routes', async () => {
    const fetchImpl = vi.fn(async () => new Response('missing', { status: 404 }));

    await expect(assertAdminExplorationReadiness('https://studio.example.test', fetchImpl)).rejects.toThrow(
      'AdminExploration admin target did not expose a usable route at: https://studio.example.test (HTTP 404).'
    );
  });

  it('rejects 5xx responses as server-side readiness failures', async () => {
    const fetchImpl = vi.fn(async () => new Response('down', { status: 503 }));

    await expect(assertAdminExplorationReadiness('https://studio.example.test', fetchImpl)).rejects.toThrow(
      'AdminExploration admin target responded with HTTP 503: https://studio.example.test'
    );
  });
});
