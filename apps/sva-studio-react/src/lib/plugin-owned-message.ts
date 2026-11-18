import { isPluginTenantLifecycleMessageKey, type PluginTranslations } from '@sva/plugin-sdk';

const hasOwnTextLeaf = (
  resources: Readonly<Record<string, unknown>> | undefined,
  key: string
): boolean => {
  let pointer: unknown = resources;
  for (const segment of key.split('.')) {
    if (!pointer || typeof pointer !== 'object' || !Object.hasOwn(pointer, segment)) {
      return false;
    }
    pointer = (pointer as Readonly<Record<string, unknown>>)[segment];
  }
  return typeof pointer === 'string' && pointer.trim().length > 0;
};

/**
 * A plugin-reported message key is trusted only when it is a key path for which the reporting
 * plugin itself ships text. Host keys, keys of other plugins, unknown keys and free text are not.
 */
export const isPluginOwnedMessageKey = (
  key: string | undefined,
  translations: PluginTranslations | undefined
): key is string =>
  isPluginTenantLifecycleMessageKey(key) &&
  Object.values(translations ?? {}).some((resources) => hasOwnTextLeaf(resources, key));
