export type SupportedRequestLocale = 'de' | 'en';

export const resolveRequestLocale = (request: Request): SupportedRequestLocale => {
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
