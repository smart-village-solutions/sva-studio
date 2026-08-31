import { resolveRequestLocale } from '../shared/request-locale.js';

export type PluginTenantLifecycleMessageKey =
  | 'instanceNotFound'
  | 'invalidInstanceId'
  | 'invalidRequest'
  | 'lifecycleStartFailed'
  | 'pluginAccessBlocked';

const messages = {
  de: {
    instanceNotFound: 'Instanz wurde nicht gefunden.',
    invalidInstanceId: 'Instanz-ID fehlt.',
    invalidRequest: 'Der Request-Body ist ungültig.',
    lifecycleStartFailed: 'Der Plugin-Lifecycle konnte nicht gestartet werden.',
    pluginAccessBlocked: 'Der Plugin-Fachzugriff ist noch nicht betriebsbereit.',
  },
  en: {
    instanceNotFound: 'The instance was not found.',
    invalidInstanceId: 'The instance ID is missing.',
    invalidRequest: 'The request body is invalid.',
    lifecycleStartFailed: 'The plugin lifecycle operation could not be started.',
    pluginAccessBlocked: 'The plugin is not ready for tenant operations yet.',
  },
} as const satisfies Record<
  ReturnType<typeof resolveRequestLocale>,
  Record<PluginTenantLifecycleMessageKey, string>
>;

export const translatePluginTenantLifecycleMessage = (
  request: Request,
  key: PluginTenantLifecycleMessageKey
): string => messages[resolveRequestLocale(request)][key];
