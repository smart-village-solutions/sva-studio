/** Public browser contract for the host-owned fixed catalog editor. */
export {
  APP_TRANSLATION_LOCALES,
  APP_TRANSLATION_MAX_LOCALES,
  isAppTranslationLocale,
  appTranslationLanguage,
  catalogDigest,
  catalogTextIsCurrent,
  catalogTranslationSource,
  validateCatalogManifest,
  validateCatalogValue,
} from '@sva/core';
export type {
  AppTranslationLocale,
  CatalogDraft,
  CatalogEditorData,
  CatalogManifest,
  CatalogOverview,
  CatalogRelease,
  CatalogScope,
  CatalogValue,
} from '@sva/core';

export * from './app-translations-provider.js';
