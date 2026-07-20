import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  readFile: vi.fn(),
  agentOptions: vi.fn(),
  undiciFetch: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({ readFile: state.readFile }));
vi.mock('undici', () => ({
  Agent: class Agent {
    constructor(options: unknown) {
      state.agentOptions(options);
    }
  },
  fetch: state.undiciFetch,
}));

describe('createStudioFetch', () => {
  it('uses the platform fetch without a private CA', async () => {
    const { createStudioFetch } = await import('./fetch.js');
    expect(await createStudioFetch()).toBe(fetch);
    expect(state.readFile).not.toHaveBeenCalled();
  });

  it('loads the configured CA and binds its dispatcher to undici requests', async () => {
    state.readFile.mockResolvedValue('test-ca');
    const expected = new Response('ok');
    state.undiciFetch.mockResolvedValue(expected);
    const { createStudioFetch } = await import('./fetch.js');
    const studioFetch = await createStudioFetch('/certs/studio-ca.pem');
    const response = await studioFetch(new Request('https://studio.example/api'), { method: 'POST' });
    expect(response).toBe(expected);
    expect(state.readFile).toHaveBeenCalledWith('/certs/studio-ca.pem', 'utf8');
    expect(state.agentOptions).toHaveBeenCalledWith({ connect: { ca: 'test-ca', rejectUnauthorized: true } });
    expect(state.undiciFetch).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({ method: 'POST', dispatcher: expect.anything() }));
  });
});
