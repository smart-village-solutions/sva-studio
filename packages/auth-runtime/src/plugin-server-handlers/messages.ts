import { resolveRequestLocale } from '../shared/request-locale.js';

export type PluginServerHandlerMessageKey =
  | 'instanceScopeUnavailable'
  | 'invalidInstanceContext'
  | 'pluginUnavailable'
  | 'permissionCheckUnavailable'
  | 'permissionDenied'
  | 'platformPermissionDenied'
  | 'unsupportedScope';

const messages = {
  de: {
    instanceScopeUnavailable: 'Dieser Plugin-Endpunkt ist nicht im Instanzkontext verfügbar.',
    invalidInstanceContext: 'Kein gültiger Instanzkontext für diesen Plugin-Endpunkt.',
    pluginUnavailable: 'Das Plugin ist für diese Instanz nicht verfügbar.',
    permissionCheckUnavailable: 'Berechtigungen konnten nicht geprüft werden.',
    permissionDenied: 'Keine Berechtigung für diesen Plugin-Endpunkt.',
    platformPermissionDenied: 'Keine Plattformberechtigung für diesen Plugin-Endpunkt.',
    unsupportedScope: 'Der Plugin-Endpunkt besitzt keinen zulässigen Scope.',
  },
  en: {
    instanceScopeUnavailable: 'This plugin endpoint is not available in an instance context.',
    invalidInstanceContext: 'No valid instance context is available for this plugin endpoint.',
    pluginUnavailable: 'The plugin is not available for this instance.',
    permissionCheckUnavailable: 'Permissions could not be checked.',
    permissionDenied: 'You do not have permission to access this plugin endpoint.',
    platformPermissionDenied: 'You do not have platform permission for this plugin endpoint.',
    unsupportedScope: 'The plugin endpoint does not have a supported scope.',
  },
} as const satisfies Record<'de' | 'en', Record<PluginServerHandlerMessageKey, string>>;

export const translatePluginServerHandlerMessage = (
  request: Request,
  key: PluginServerHandlerMessageKey
): string => messages[resolveRequestLocale(request)][key];
