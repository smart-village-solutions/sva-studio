export type PluginTranslationVariables = Readonly<Record<string, string | number>>;

export type PluginTranslationResolver = (
  key: string,
  variables?: PluginTranslationVariables
) => string;

let pluginTranslationResolver: PluginTranslationResolver = (key) => key;

export const registerPluginTranslationResolver = (
  resolver: PluginTranslationResolver
): void => {
  pluginTranslationResolver = resolver;
};

export const translatePluginKey = (
  pluginId: string,
  key: string,
  variables?: PluginTranslationVariables
): string => pluginTranslationResolver(`${pluginId}.${key}`, variables);

export const usePluginTranslation = (pluginId: string) =>
  (key: string, variables?: PluginTranslationVariables) =>
    translatePluginKey(pluginId, key, variables);
