import type { PluginTranslations } from '../plugin-definition-types.js';
import { isPluginTenantLifecycleMessageKey } from './error.js';

const hasOwnTextLeaf = (
  resources: Readonly<Record<string, unknown>> | undefined,
  key: string
): boolean => {
  let pointer: unknown = resources;
  for (const segment of key.split('.')) {
    if (
      !pointer ||
      typeof pointer !== 'object' ||
      !Object.prototype.hasOwnProperty.call(pointer, segment)
    ) {
      return false;
    }
    pointer = (pointer as Readonly<Record<string, unknown>>)[segment];
  }
  return typeof pointer === 'string' && pointer.trim().length > 0;
};

/**
 * A plugin-reported message key is trusted only when it is a key path for which the reporting
 * plugin itself ships text in every locale it provides. Host keys, keys of other plugins, unknown
 * or partially translated keys and free text are rejected. The host must still resolve the key
 * in its active or fallback locale before displaying it.
 */
export const isPluginOwnedMessageKey = (
  key: string | undefined,
  translations: PluginTranslations | undefined
): key is string => {
  const locales = Object.values(translations ?? {});
  return (
    isPluginTenantLifecycleMessageKey(key) &&
    locales.length > 0 &&
    locales.every((resources) => hasOwnTextLeaf(resources, key))
  );
};
