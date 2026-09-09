/** Public, server-selected branding profiles. Keep future branding properties here. */
export const STUDIO_BRANDING_PROFILES = {
  'sva-studio': {
    anonymousTitleKey: 'shell.appName',
    anonymousSubtitleKey: 'home.hero.anonymousSubtitle',
    anonymousBodyKey: 'home.hero.anonymousBody',
  },
  'kassel-dialog': {
    anonymousTitleKey: 'home.branding.kasselDialog.title',
    anonymousSubtitleKey: 'home.branding.kasselDialog.subtitle',
    anonymousBodyKey: 'home.branding.kasselDialog.body',
  },
} as const;

export type StudioBranding = keyof typeof STUDIO_BRANDING_PROFILES;
export const STUDIO_BRANDING_META_NAME = 'sva-studio-branding';

export const resolveStudioBranding = (value: unknown): StudioBranding =>
  value === 'kassel-dialog' ? value : 'sva-studio';

export const readDocumentStudioBranding = (): StudioBranding =>
  resolveStudioBranding(
    typeof document === 'undefined'
      ? undefined
      : document.querySelector(`meta[name="${STUDIO_BRANDING_META_NAME}"]`)?.getAttribute('content')
  );
