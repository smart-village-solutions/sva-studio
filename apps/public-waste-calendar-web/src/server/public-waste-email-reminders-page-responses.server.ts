import type { WasteManagementEmailReminderConfig } from '@sva/waste-management-contracts';
import type { ReminderPageInput } from './public-waste-email-reminders-pages.server.js';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildStatusPageResponse = (input: {
  readonly title: string;
  readonly headline: string;
  readonly body: string;
}): Response =>
  new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head><body><main><h1>${escapeHtml(input.headline)}</h1><p>${escapeHtml(input.body)}</p></main></body></html>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    }
  );

export const createRedirectResponse = (
  request: Request,
  path: string,
  params: Readonly<Record<string, string>> = {}
): Response => {
  const url = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return Response.redirect(url.toString(), 302);
};

export const renderDoiSuccessPage = (config: WasteManagementEmailReminderConfig): Response =>
  buildStatusPageResponse({
    title: config.doiSuccessHeadline ?? 'E-Mail-Erinnerung aktiviert',
    headline: config.doiSuccessHeadline ?? 'E-Mail-Erinnerung aktiviert',
    body: config.doiSuccessBody ?? 'Ihre E-Mail-Erinnerung ist jetzt aktiv.',
  });

export const renderDoiErrorPage = (
  config: WasteManagementEmailReminderConfig,
  result: 'expired' | 'invalid'
): Response =>
  buildStatusPageResponse({
    title: config.doiErrorHeadline ?? 'Link ungültig',
    headline: config.doiErrorHeadline ?? 'Link ungültig',
    body:
      result === 'expired' && config.doiExpiryNoticeText
        ? config.doiExpiryNoticeText
        : (config.doiErrorBody ?? 'Der Bestätigungslink ist ungültig oder abgelaufen.'),
  });

export const renderUnsubscribeSuccessPage = (
  config: WasteManagementEmailReminderConfig,
  state: 'unsubscribed' | 'already_unsubscribed'
): Response =>
  buildStatusPageResponse({
    title:
      state === 'already_unsubscribed'
        ? (config.unsubscribeAlreadyDoneHeadline ?? config.unsubscribeSuccessHeadline)
        : config.unsubscribeSuccessHeadline,
    headline:
      state === 'already_unsubscribed'
        ? (config.unsubscribeAlreadyDoneHeadline ?? config.unsubscribeSuccessHeadline)
        : config.unsubscribeSuccessHeadline,
    body:
      state === 'already_unsubscribed'
        ? (config.unsubscribeAlreadyDoneBody ?? config.unsubscribeSuccessBody)
        : config.unsubscribeSuccessBody,
  });

export const renderUnsubscribeErrorPage = (config: WasteManagementEmailReminderConfig): Response =>
  buildStatusPageResponse({
    title: config.unsubscribeErrorHeadline ?? 'Abmeldung fehlgeschlagen',
    headline: config.unsubscribeErrorHeadline ?? 'Abmeldung fehlgeschlagen',
    body: config.unsubscribeErrorBody ?? 'Der Abmeldelink ist ungültig oder nicht mehr verwendbar.',
  });

export const renderConfiguredReminderStatusPage = (input: {
  readonly request: Request;
  readonly pathname: string;
  readonly reminderConfig: WasteManagementEmailReminderConfig;
}): Response | null => {
  const { pathname, reminderConfig: config } = input;
  const url = new URL(input.request.url);

  if (config.activationSuccessPath && pathname === config.activationSuccessPath) {
    return renderDoiSuccessPage(config);
  }
  if (config.unsubscribeSuccessPath && pathname === config.unsubscribeSuccessPath) {
    const state =
      url.searchParams.get('state') === 'already_unsubscribed'
        ? 'already_unsubscribed'
        : 'unsubscribed';
    return renderUnsubscribeSuccessPage(config, state);
  }
  if (config.invalidTokenPath && pathname === config.invalidTokenPath) {
    return url.searchParams.get('source') === 'unsubscribe'
      ? renderUnsubscribeErrorPage(config)
      : renderDoiErrorPage(config, 'invalid');
  }
  return null;
};

export const renderDoiActionError = (
  input: ReminderPageInput,
  result: 'expired' | 'invalid'
): Response =>
  input.reminderConfig.invalidTokenPath
    ? createRedirectResponse(input.request, input.reminderConfig.invalidTokenPath, {
        source: 'doi',
        reason: result,
      })
    : renderDoiErrorPage(input.reminderConfig, result);

export const renderUnsubscribeActionError = (input: ReminderPageInput): Response =>
  input.reminderConfig.invalidTokenPath
    ? createRedirectResponse(input.request, input.reminderConfig.invalidTokenPath, {
        source: 'unsubscribe',
        reason: 'invalid',
      })
    : renderUnsubscribeErrorPage(input.reminderConfig);
