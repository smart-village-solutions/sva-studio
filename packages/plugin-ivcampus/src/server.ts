import { randomBytes } from 'node:crypto';

import type { PluginServerExecutionHandler } from '@sva/plugin-sdk';

import { ivCampusTranslations } from './translations.js';

export { ivCampusPilotStudioOrigin, ivCampusWidgetPath } from './widget-path.js';

// Widget delivery uses the host's dedicated HTTP route. The catalog still initializes this server entry.
export const createPluginServerHandlers = (): Readonly<
  Record<string, PluginServerExecutionHandler>
> => ({});

// ivCampus documents the wire protocol for widgets without a browser bundle.
// https://github.com/ivicos-GmbH/widget-sdk#das-protokoll-falls-du-dieses-sdk-nicht-verwendest
const widgetScript = `
const root = document.querySelector('main');
const status = document.querySelector('[role="status"]');
const buttons = document.querySelectorAll('button[data-path]');
const hostOrigin = root.dataset.hostOrigin;
const widgetId = 'sva-studio-sandbox-app-redaktion';
const pending = new Map();
let handshakeComplete = false;

function send(message) {
  window.parent.postMessage({ source: 'ivicos-widget-sdk', ...message }, hostOrigin);
}

function showFailure(key) {
  status.textContent = root.dataset[key];
}

if (window.parent === window) {
  showFailure('unavailable');
} else {
  const timer = setTimeout(() => showFailure('unavailable'), 10000);
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== hostOrigin) return;
    const message = event.data;
    if (!message || message.source !== 'ivicos-widget-host') return;
    if (message.type === 'handshake' && typeof message.nonce === 'string') {
      send({ type: 'handshake-ack', nonce: message.nonce });
      handshakeComplete = true;
    }
    if (message.type === 'context' && handshakeComplete) {
      clearTimeout(timer);
      status.textContent = '';
      for (const button of buttons) button.disabled = false;
    }
    if (message.type === 'open-url-result' && pending.has(message.requestId)) {
      clearTimeout(pending.get(message.requestId));
      pending.delete(message.requestId);
      if (message.status !== 'opened') showFailure('openingFailed');
    }
  });

  for (const button of buttons) {
    button.addEventListener('click', () => {
      status.textContent = '';
      const requestId = crypto.randomUUID();
      pending.set(requestId, setTimeout(() => {
        pending.delete(requestId);
        showFailure('openingFailed');
      }, 5000));
      send({ type: 'open-url', requestId, url: new URL(button.dataset.path, location.origin).href });
    });
  }
  send({ type: 'ready', widgetId, sdkVersion: 2 });
}
`;

export function parseIvCampusOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const origin = new URL(value).origin;
    return origin.startsWith('https://') && (value === origin || value === origin + '/')
      ? origin
      : undefined;
  } catch {
    return undefined;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createIvCampusWidgetResponse(request: Request, origin: string): Response {
  const nonce = randomBytes(18).toString('base64');
  const locale = /^en(?:[-,;]|$)/i.test(request.headers.get('accept-language') ?? '') ? 'en' : 'de';
  const translate = (key: keyof typeof ivCampusTranslations.de.ivcampus) =>
    escapeHtml(ivCampusTranslations[locale].ivcampus[key]);

  return new Response(
    request.method === 'HEAD'
      ? null
      : `<!doctype html>
<html lang="${locale}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${translate('title')}</title>
<main aria-label="${translate('title')}" data-host-origin="${escapeHtml(origin)}"
  data-opening-failed="${translate('openingFailed')}" data-unavailable="${translate('unavailable')}">
  <p><button type="button" data-path="/admin/news/new" disabled>${translate('news')}</button></p>
  <p><button type="button" data-path="/admin/events/new" disabled>${translate('event')}</button></p>
  <p role="status"></p>
</main>
<script nonce="${nonce}">${widgetScript}</script>
</html>`,
    {
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors ${origin}`,
        'referrer-policy': 'no-referrer',
      },
    }
  );
}
