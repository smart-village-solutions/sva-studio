import { describe, expect, it, vi } from 'vitest';

import { createMutationWorkflow } from '../index.js';

const readJson = async (response: Response) => JSON.parse(await response.text());

describe('mutation workflow', () => {
  it('runs the configured mutation pipeline in order', async () => {
    const steps: string[] = [];
    const handler = createMutationWorkflow<
      { userId: string },
      { requestId: string; actorId: string },
      { scope: 'write' },
      { idempotencyKey: string },
      { enabled: boolean },
      { ok: true }
    >({
      prepare: ({ context }) => {
        steps.push('prepare');
        return { requestId: 'req-1', actorId: context.userId };
      },
      authorize: (state) => {
        steps.push('authorize');
        expect(state.actorId).toBe('u-1');
        return { scope: 'write' };
      },
      csrf: () => {
        steps.push('csrf');
      },
      idempotency: () => {
        steps.push('idempotency');
        return { idempotencyKey: 'idem-1' };
      },
      parse: async () => {
        steps.push('parse');
        return { enabled: true };
      },
      execute: async (state) => {
        steps.push('execute');
        expect(state.input.enabled).toBe(true);
        expect(state.idempotencyKey).toBe('idem-1');
        return { ok: true };
      },
      mapError: (error) => new Response(`mapped:${String(error)}`, { status: 500 }),
      respond: (result, state) => {
        steps.push('respond');
        return new Response(
          JSON.stringify({
            result,
            actorId: state.actorId,
            requestId: state.requestId,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      },
    });

    const response = await handler(new Request('http://localhost/mutations', { method: 'POST' }), { userId: 'u-1' });

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toMatchObject({
      result: { ok: true },
      actorId: 'u-1',
      requestId: 'req-1',
    });
    expect(steps).toEqual(['prepare', 'authorize', 'csrf', 'idempotency', 'parse', 'execute', 'respond']);
  });

  it('stops before parse when authorization returns a response', async () => {
    const parse = vi.fn();
    const execute = vi.fn();
    const handler = createMutationWorkflow<
      { userId: string },
      { requestId: string },
      { scope: 'write' },
      { idempotencyKey: string },
      { enabled: boolean },
      { ok: true }
    >({
      prepare: () => ({ requestId: 'req-2' }),
      authorize: () => new Response('forbidden', { status: 403 }),
      csrf: () => {
        throw new Error('csrf should not run');
      },
      idempotency: () => {
        throw new Error('idempotency should not run');
      },
      parse,
      execute,
      mapError: (error) => new Response(`mapped:${String(error)}`, { status: 500 }),
      respond: () => new Response('ok'),
    });

    const response = await handler(new Request('http://localhost/mutations', { method: 'POST' }), { userId: 'u-2' });

    expect(response.status).toBe(403);
    expect(parse).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses the mapped error response when execute throws', async () => {
    const mapError = vi.fn(() => new Response('mapped', { status: 409 }));
    const handler = createMutationWorkflow<
      { userId: string },
      { requestId: string },
      { scope: 'write' },
      { idempotencyKey: string },
      { enabled: boolean },
      { ok: true }
    >({
      prepare: () => ({ requestId: 'req-3' }),
      authorize: () => ({ scope: 'write' }),
      csrf: () => undefined,
      idempotency: () => ({ idempotencyKey: 'idem-3' }),
      parse: async () => ({ enabled: true }),
      execute: async () => {
        throw new Error('boom');
      },
      mapError,
      respond: () => new Response('ok'),
    });

    const response = await handler(new Request('http://localhost/mutations', { method: 'POST' }), { userId: 'u-3' });

    expect(response.status).toBe(409);
    expect(mapError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ requestId: 'req-3' }));
  });
});
