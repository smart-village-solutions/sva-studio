export const appTranslationLanguageNames = (locales: readonly string[]): Record<string, string> =>
  Object.fromEntries(
    ['de', ...locales].map((locale) => {
      const name = new Intl.DisplayNames([locale], {
        type: 'language',
        languageDisplay: 'standard',
        fallback: 'none',
      }).of(locale);
      return [locale, name?.replace(/^./u, (letter) => letter.toLocaleUpperCase(locale)) ?? locale];
    })
  );

export const languageNamesMatch = (
  expected: Record<string, string>,
  actual: Record<string, string> | undefined
): boolean => Object.entries(expected).every(([locale, name]) => actual?.[locale] === name);
