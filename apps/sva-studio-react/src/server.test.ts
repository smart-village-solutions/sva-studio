import { afterEach, describe, expect, it, vi } from 'vitest';

const createStartHandlerMock = vi.fn();

vi.mock('@tanstack/react-start/server', () => ({
  createStartHandler: createStartHandlerMock,
  defaultStreamHandler: {},
}));

describe('server transport', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    createStartHandlerMock.mockReset();
  });

  it('routes auth requests through TanStack Start instead of a manual auth bypass', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/auth/login'));

    expect(startFetch).toHaveBeenCalledTimes(1);
    expect(startFetch).toHaveBeenCalledWith(expect.any(Request), undefined);
    await expect(response.text()).resolves.toBe('ok');
  });
});
