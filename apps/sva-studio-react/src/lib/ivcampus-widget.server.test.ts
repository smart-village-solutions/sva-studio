import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchIvCampusWidgetRequest } from './ivcampus-widget.server';
import { finalizeProtectedApiResponse } from './server-entry-error-finalization.server';

const access = vi.hoisted(() => vi.fn());
vi.mock('@sva/auth-runtime/server', () => ({
  buildRequestOriginFromHeaders: (request: Request) => new URL(request.url).origin,
  readConfiguredPluginTenantAccess: access,
  resolveAuthConfigForRequest: async () => ({ kind: 'instance', instanceId: 'de-studio-sandbox' }),
}));
vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ warn: vi.fn() }),
}));

const sandbox = 'https://de-studio-sandbox.studio-staging.smart-village.app';
const path = '/integrations/ivcampus/widget';

describe('ivCampus widget route', () => {
  beforeEach(() => {
    vi.stubEnv('SVA_IVCAMPUS_PILOT_ORIGIN', 'https://campus.example');
    access.mockResolvedValue({ allowed: true });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    access.mockReset();
  });

  it('embeds only the widget and supplies both Studio creation links', async () => {
    const request = new Request(sandbox + path);
    const response = await dispatchIvCampusWidgetRequest(request);
    if (!response) throw new Error('Widget response missing');
    expect(response.status).toBe(200);
    const finalized = await finalizeProtectedApiResponse(request, response, undefined, vi.fn());
    expect(finalized.headers.has('x-frame-options')).toBe(false);
    expect(finalized.headers.get('content-security-policy')).toMatch(
      /frame-ancestors https:\/\/campus\.example$/
    );
    expect(finalized.headers.get('cache-control')).toBe('no-store');
    const body = await finalized.text();
    expect(body).toContain('data-path="/admin/news/new"');
    expect(body).toContain('data-path="/admin/events/new"');
    expect(body).toContain('sva-studio-sandbox-app-redaktion');

    const studio = await finalizeProtectedApiResponse(
      new Request(sandbox + '/admin/content'),
      new Response('', { headers: { 'content-type': 'text/html' } }),
      undefined,
      vi.fn()
    );
    expect(studio.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('activates the links after the configured parent completes the handshake', async () => {
    const response = await dispatchIvCampusWidgetRequest(new Request(sandbox + path));
    if (!response) throw new Error('Widget response missing');
    const script = (await response.text()).match(/<script[^>]*>([\s\S]+?)<\/script>/)?.[1];
    if (!script) throw new Error('Widget script missing');
    const campus = 'https://campus.example';
    const postMessage = vi.fn();
    const parent = { postMessage };
    const status = { textContent: '' };
    const click = vi.fn();
    const button = {
      disabled: true,
      dataset: { path: '/admin/news/new' },
      addEventListener: click,
    };
    const listen = vi.fn();
    runInNewContext(script, {
      URL,
      crypto: { randomUUID: () => 'request-id' },
      location: { origin: sandbox },
      window: { parent, addEventListener: listen },
      document: {
        querySelector: (selector: string) =>
          selector === 'main' ? { dataset: { hostOrigin: campus } } : status,
        querySelectorAll: () => [button],
      },
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
    });

    expect(postMessage).toHaveBeenCalledWith(
      {
        source: 'ivicos-widget-sdk',
        type: 'ready',
        widgetId: 'sva-studio-sandbox-app-redaktion',
        sdkVersion: 2,
      },
      campus
    );
    const receive = (origin: string, type: string, source = parent) =>
      listen.mock.calls[0]?.[1]({
        origin,
        source,
        data: { source: 'ivicos-widget-host', type, nonce: 'host-nonce' },
      });
    receive(campus, 'context');
    receive('https://other.example', 'handshake');
    receive(campus, 'handshake', { postMessage: vi.fn() });
    expect(button.disabled).toBe(true);
    expect(postMessage).toHaveBeenCalledTimes(1);

    receive(campus, 'handshake');
    receive(campus, 'context');
    expect(button.disabled).toBe(false);
    expect(postMessage).toHaveBeenCalledWith(
      { source: 'ivicos-widget-sdk', type: 'handshake-ack', nonce: 'host-nonce' },
      campus
    );
    click.mock.calls[0]?.[1]();
    expect(postMessage).toHaveBeenCalledWith(
      {
        source: 'ivicos-widget-sdk',
        type: 'open-url',
        requestId: 'request-id',
        url: sandbox + '/admin/news/new',
      },
      campus
    );
  });

  it('rejects other hosts and invalid ivCampus origins', async () => {
    expect(
      (await dispatchIvCampusWidgetRequest(new Request('https://other.example' + path)))?.status
    ).toBe(404);
    vi.stubEnv('SVA_IVCAMPUS_PILOT_ORIGIN', 'https://campus.example/room');
    expect((await dispatchIvCampusWidgetRequest(new Request(sandbox + path)))?.status).toBe(404);
    expect(access).not.toHaveBeenCalled();
  });

  it('rejects unassigned modules and does not accept writes', async () => {
    access.mockResolvedValue({ allowed: false });
    expect((await dispatchIvCampusWidgetRequest(new Request(sandbox + path)))?.status).toBe(404);
    expect(access).toHaveBeenCalledWith('de-studio-sandbox', 'ivcampus');
    expect(
      (await dispatchIvCampusWidgetRequest(new Request(sandbox + path, { method: 'POST' })))?.status
    ).toBe(405);
  });
});
