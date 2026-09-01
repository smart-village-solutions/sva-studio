import { resolveRequestLocale } from '../shared/request-locale.js';

const messages = {
  de: {
    pluginActivationRequiredCannotDisable:
      'Ein verpflichtendes Plugin kann nicht deaktiviert werden.',
  },
  en: {
    pluginActivationRequiredCannotDisable: 'A required plugin cannot be disabled.',
  },
} as const;

export const translateInstanceRegistryMessage = (
  request: Request,
  key: keyof (typeof messages)['de']
): string => messages[resolveRequestLocale(request)][key];
