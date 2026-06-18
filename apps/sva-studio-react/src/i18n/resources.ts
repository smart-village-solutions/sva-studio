import { deResources } from './resources/de.js';
import { enResources } from './resources/en.js';
import {
  commitMergedPluginSources,
  createMergeTracker,
  mergePluginLocaleResources,
  type TranslationNode,
} from './resources-merge';

export const i18nResources = {
  de: deResources,
  en: enResources,
} as const;

const mergedSourceTracker = createMergeTracker(Object.keys(i18nResources) as SupportedLocale[]);

export const mergeI18nResources = (
  resources: Readonly<Record<SupportedLocale, Readonly<Record<string, unknown>>>>
) => {
  const mutableResources = i18nResources as unknown as Record<SupportedLocale, Record<string, unknown>>;
  const mergedResources = { ...mutableResources } as Record<SupportedLocale, Record<string, unknown>>;
  const mergedSources: Array<{
    locale: SupportedLocale;
    source: object;
    signature: string;
  }> = [];

  for (const locale of Object.keys(resources) as SupportedLocale[]) {
    const source = resources[locale];
    const target = mutableResources[locale] as Record<string, TranslationNode>;
    const { mergedLocaleResource, pendingSource } = mergePluginLocaleResources({
      locale,
      source: source as Record<string, TranslationNode>,
      target,
      tracker: mergedSourceTracker,
    });
    mergedResources[locale] = mergedLocaleResource as Record<string, unknown>;
    mergedSources.push(pendingSource);
  }

  for (const locale of Object.keys(mergedResources) as SupportedLocale[]) {
    mutableResources[locale] = mergedResources[locale];
  }

  commitMergedPluginSources(mergedSourceTracker, mergedSources);
};

export const DEFAULT_LOCALE = 'de';

export type SupportedLocale = keyof typeof i18nResources;
