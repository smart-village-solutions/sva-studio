import { resolveRequestLocale } from '../shared/request-locale.js';

export type PluginTenantLifecycleMessageKey =
  | 'instanceNotFound'
  | 'invalidInstanceId'
  | 'invalidRequest'
  | 'lifecycleStartFailed';

const messages = {
  de: {
    instanceNotFound: 'Instanz wurde nicht gefunden.',
    invalidInstanceId: 'Instanz-ID fehlt.',
    invalidRequest: 'Der Request-Body ist ungültig.',
    lifecycleStartFailed: 'Der Plugin-Lifecycle konnte nicht gestartet werden.',
  },
  en: {
    instanceNotFound: 'The instance was not found.',
    invalidInstanceId: 'The instance ID is missing.',
    invalidRequest: 'The request body is invalid.',
    lifecycleStartFailed: 'The plugin lifecycle operation could not be started.',
  },
} as const satisfies Record<
  ReturnType<typeof resolveRequestLocale>,
  Record<PluginTenantLifecycleMessageKey, string>
>;

export const translatePluginTenantLifecycleMessage = (
  request: Request,
  key: PluginTenantLifecycleMessageKey
): string => messages[resolveRequestLocale(request)][key];
