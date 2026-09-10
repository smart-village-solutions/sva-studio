/** Public, server-selected branding profiles. Keep future branding properties here. */
export const STUDIO_BRANDING_PROFILES = {
  'sva-studio': {
    appNameKey: 'shell.appName',
    anonymousSubtitleKey: 'home.hero.anonymousSubtitle',
    anonymousBodyKey: 'home.hero.anonymousBody',
    showContentNavigation: true,
    showGenericApplicationLinks: true,
    showInterfacesNavigation: true,
    showModulesNavigation: true,
  },
  'kassel-dialog': {
    appNameKey: 'home.branding.kasselDialog.title',
    anonymousSubtitleKey: 'home.branding.kasselDialog.subtitle',
    anonymousBodyKey: 'home.branding.kasselDialog.body',
    showContentNavigation: false,
    showGenericApplicationLinks: false,
    showInterfacesNavigation: false,
    showModulesNavigation: false,
  },
} as const;

export type StudioBranding = keyof typeof STUDIO_BRANDING_PROFILES;
export const STUDIO_BRANDING_META_NAME = 'sva-studio-branding';

export const resolveStudioBranding = (value: unknown): StudioBranding =>
  typeof value === 'string' && Object.hasOwn(STUDIO_BRANDING_PROFILES, value)
    ? (value as StudioBranding)
    : 'sva-studio';

export const readDocumentStudioBranding = (): StudioBranding =>
  resolveStudioBranding(
    typeof document === 'undefined'
      ? undefined
      : document.querySelector(`meta[name="${STUDIO_BRANDING_META_NAME}"]`)?.getAttribute('content')
  );
