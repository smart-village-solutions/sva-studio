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

const resolveLocale = (request: Request): keyof typeof messages => {
  const acceptedLanguages = request.headers.get('accept-language')?.toLowerCase() ?? '';
  const supportedPreference = acceptedLanguages
    .split(',')
    .map((entry, index) => {
      const [language = '', ...parameters] = entry.trim().split(';');
      const quality = Number(
        parameters
          .find((parameter) => parameter.trim().startsWith('q='))
          ?.trim()
          .slice(2) ?? 1
      );
      return { language, quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter(({ language }) => /^(de|en)(-|$)/.test(language))
    .sort((left, right) => right.quality - left.quality || left.index - right.index)[0];
  return supportedPreference?.language.startsWith('en') ? 'en' : 'de';
};

export const translatePluginServerHandlerMessage = (
  request: Request,
  key: PluginServerHandlerMessageKey
): string => messages[resolveLocale(request)][key];
