import type { PluginDefinition } from './plugin-definition-types.js';

export type PluginTranslationVariables = Readonly<Record<string, string | number>>;

export type PluginTranslationResolver = (
  key: string,
  variables?: PluginTranslationVariables
) => string;

let pluginTranslationResolver: PluginTranslationResolver = (key) => key;
const pluginTranslationHookCache = new Map<
  string,
  (key: string, variables?: PluginTranslationVariables) => string
>();

export const registerPluginTranslationResolver = (resolver: PluginTranslationResolver): void => {
  pluginTranslationResolver = resolver;
};

export const translatePluginKey = (
  pluginId: string,
  key: string,
  variables?: PluginTranslationVariables
): string => pluginTranslationResolver(`${pluginId}.${key}`, variables);

export const usePluginTranslation = (pluginId: string) => {
  const cached = pluginTranslationHookCache.get(pluginId);
  if (cached) {
    return cached;
  }

  const translate = (key: string, variables?: PluginTranslationVariables) =>
    translatePluginKey(pluginId, key, variables);
  pluginTranslationHookCache.set(pluginId, translate);
  return translate;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

const mergeTranslationNode = (
  target: Record<string, unknown>,
  source: Readonly<Record<string, unknown>>,
  locale: string,
  pathPrefix = ''
): Record<string, unknown> => {
  for (const [key, value] of Object.entries(source)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    const targetValue = target[key];
    if (isRecord(value) && isRecord(targetValue)) {
      target[key] = mergeTranslationNode({ ...targetValue }, value, locale, path);
      continue;
    }

    if (targetValue !== undefined) {
      throw new Error(`duplicate_plugin_translation_key:${locale}:${path}`);
    }

    target[key] = value;
  }

  return target;
};

export const mergePluginTranslations = (
  plugins: readonly PluginDefinition[]
): Readonly<Record<string, Readonly<Record<string, unknown>>>> => {
  const merged: Record<string, Record<string, unknown>> = {};

  for (const plugin of plugins) {
    for (const [locale, resources] of Object.entries(plugin.translations ?? {})) {
      const currentLocaleResources = merged[locale] ?? {};
      merged[locale] = mergeTranslationNode(currentLocaleResources, resources, locale);
    }
  }

  return merged;
};
