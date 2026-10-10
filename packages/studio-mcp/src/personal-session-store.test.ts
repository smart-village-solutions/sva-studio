import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: state.spawn }));
import { MacOsPersonalSessionStore, personalSessionBinding } from './personal-session-store.js';
const context = {
  id: 'test',
  name: 'Test',
  kind: 'tenant' as const,
  tenantId: 'test',
  baseUrl: 'https://test.studio.example',
  issuer: 'https://id.example/realms/test',
  clientId: 'mcp',
};
const stored = {
  version: 1 as const,
  binding: personalSessionBinding(context),
  subject: 'test-subject',
  account: 'test-account',
  refreshToken: 'synthetic-test-refresh',
};
const response = (code: number, output = '') => {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    kill: vi.fn(),
  });
  child.stdin.once('finish', () => {
    child.stdout.write(output);
    child.emit('close', code);
  });
  state.spawn.mockReturnValueOnce(child);
  return child;
};
describe('macOS personal session store', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
  });
  it('writes refresh credentials through stdin only', async () => {
    const child = response(0);
    let input = '';
    child.stdin.on('data', (chunk: Buffer) => {
      input += chunk.toString();
    });
    await new MacOsPersonalSessionStore().save(context, stored);
    expect(state.spawn).toHaveBeenCalledWith('/usr/bin/security', ['-i'], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    expect(input).toContain('add-generic-password -U');
    expect(input).toContain(Buffer.from(JSON.stringify(stored)).toString('base64'));
    expect(JSON.stringify(state.spawn.mock.calls)).not.toContain(stored.refreshToken);
  });
  it('loads only a validated context-bound record', async () => {
    response(0, Buffer.from(JSON.stringify(stored)).toString('base64') + '\n');
    await expect(new MacOsPersonalSessionStore().load(context)).resolves.toEqual(stored);
  });
  it('treats a missing entry as logged out', async () => {
    response(44);
    await expect(new MacOsPersonalSessionStore().load(context)).resolves.toBeUndefined();
  });
  it.each(['binding', 'invalid-json', 'extra-token'] as const)(
    'removes malformed storage (%s)',
    async (kind) => {
      const raw =
        kind === 'invalid-json'
          ? '{'
          : JSON.stringify({
              ...stored,
              ...(kind === 'binding' ? { binding: 'other' } : { accessToken: 'not-allowed' }),
            });
      response(0, Buffer.from(raw).toString('base64'));
      response(0);
      await expect(new MacOsPersonalSessionStore().load(context)).rejects.toMatchObject({
        code: 'context_login_required',
      });
      expect(state.spawn.mock.calls[1]?.[1]).toContain('delete-generic-password');
    }
  );
  it.each([
    ['load', 36],
    ['save', 1],
    ['delete', 36],
  ] as const)('fails closed on %s errors', async (method, code) => {
    response(code, 'private system detail');
    const store = new MacOsPersonalSessionStore();
    const promise = method === 'save' ? store.save(context, stored) : store[method](context);
    await expect(promise).rejects.toMatchObject({ message: 'personal_session_store_unavailable' });
  });
  it('separates issuer, host, client, context and tenant bindings', () => {
    for (const changed of [
      { id: 'other' },
      { issuer: 'https://id.example/realms/other' },
      { baseUrl: 'https://other.studio.example' },
      { clientId: 'other' },
      { tenantId: 'other' },
    ]) {
      expect(personalSessionBinding({ ...context, ...changed })).not.toBe(stored.binding);
    }
  });
  it('does not silently fall back on unsupported platforms', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    expect(() => new MacOsPersonalSessionStore()).toThrow('personal_session_store_unavailable');
  });
});
