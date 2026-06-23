export const createPoiLocaleTranslations = <TPoi extends Readonly<Record<string, unknown>>>(poi: TPoi) =>
  ({ poi }) as const;
