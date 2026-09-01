export type SupportedRequestLocale = 'de' | 'en';

export const resolveRequestLocale = (request: Request): SupportedRequestLocale => {
  const acceptedLanguages = request.headers.get('accept-language')?.toLowerCase() ?? '';
  const supportedPreference = acceptedLanguages
    .split(',')
    .map((entry, index) => {
      const [language = '', ...parameters] = entry.trim().split(';');
      const parsedQuality = Number(
        parameters
          .find((parameter) => parameter.trim().startsWith('q='))
          ?.trim()
          .slice(2) ?? 1
      );
      const quality = Number.isFinite(parsedQuality)
        ? Math.min(1, Math.max(0, parsedQuality))
        : 0;
      return { language, quality, index };
    })
    .filter(({ language, quality }) => quality > 0 && /^(de|en)(-|$)/.test(language))
    .sort((left, right) => right.quality - left.quality || left.index - right.index)[0];
  return supportedPreference?.language.startsWith('en') ? 'en' : 'de';
};
