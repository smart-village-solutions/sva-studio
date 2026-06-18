export type TranslationNode = string | { [key: string]: TranslationNode };

export type TranslationRecord = Record<string, TranslationNode>;

type MergeTracker<TLocale extends string> = Readonly<{
  mergedPluginSourcesByLocale: Record<TLocale, WeakSet<object>>;
  mergedPluginSourceSignaturesByLocale: Record<TLocale, Set<string>>;
}>;

type PendingMergedLocaleSource<TLocale extends string> = Readonly<{
  locale: TLocale;
  source: object;
  signature: string;
}>;

const isTranslationBranch = (value: unknown): value is TranslationRecord =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

const mergeTranslationBranch = (
  target: TranslationRecord,
  source: TranslationRecord,
  locale: string,
  pathPrefix = ''
): TranslationRecord => {
  for (const [key, value] of Object.entries(source)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (isTranslationBranch(value) && isTranslationBranch(target[key])) {
      target[key] = mergeTranslationBranch(
        { ...(target[key] as TranslationRecord) },
        value,
        locale,
        path
      );
      continue;
    }

    if (target[key] !== undefined) {
      if (target[key] === value) {
        continue;
      }
      throw new Error(`duplicate_i18n_key:${locale}:${path}`);
    }

    target[key] = value;
  }

  return target;
};

export const createMergeTracker = <TLocale extends string>(
  locales: readonly TLocale[]
): MergeTracker<TLocale> => ({
  mergedPluginSourcesByLocale: Object.fromEntries(
    locales.map((locale) => [locale, new WeakSet<object>()])
  ) as Record<TLocale, WeakSet<object>>,
  mergedPluginSourceSignaturesByLocale: Object.fromEntries(
    locales.map((locale) => [locale, new Set<string>()])
  ) as Record<TLocale, Set<string>>,
});

export const mergePluginLocaleResources = <TLocale extends string>(input: {
  locale: TLocale;
  source: TranslationRecord;
  target: TranslationRecord;
  tracker: MergeTracker<TLocale>;
}): Readonly<{
  mergedLocaleResource: TranslationRecord;
  pendingSource: PendingMergedLocaleSource<TLocale>;
}> => {
  const sourceSignature = JSON.stringify(input.source);

  return {
    mergedLocaleResource: mergeTranslationBranch(
      { ...input.target },
      input.source,
      input.locale
    ),
    pendingSource: {
      locale: input.locale,
      source: input.source,
      signature: sourceSignature,
    },
  };
};

export const commitMergedPluginSources = <TLocale extends string>(
  tracker: MergeTracker<TLocale>,
  pendingSources: readonly PendingMergedLocaleSource<TLocale>[]
) => {
  for (const pendingSource of pendingSources) {
    tracker.mergedPluginSourcesByLocale[pendingSource.locale].add(pendingSource.source);
    tracker.mergedPluginSourceSignaturesByLocale[pendingSource.locale].add(pendingSource.signature);
  }
};
