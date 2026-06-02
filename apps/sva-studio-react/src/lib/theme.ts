export type ThemeMode = 'light' | 'dark';

// Phase 1 keeps the existing runtime theme ids to avoid wide churn.
export type AppThemeName = 'sva-default' | 'sva-forest';

export const THEME_MODE_STORAGE_KEY = 'sva-studio.theme-mode';
export const DEFAULT_THEME_NAME: AppThemeName = 'sva-default';

const INSTANCE_THEME_MAP: Readonly<Record<string, AppThemeName>> = {
  '11111111-1111-1111-8111-111111111111': 'sva-forest',
};

export const isThemeMode = (value: string | null | undefined): value is ThemeMode => value === 'light' || value === 'dark';

export const resolveThemeName = (instanceId?: string): AppThemeName => {
  if (!instanceId) {
    return DEFAULT_THEME_NAME;
  }

  return INSTANCE_THEME_MAP[instanceId] ?? DEFAULT_THEME_NAME;
};

export const resolveThemeMode = (
  persistedMode: string | null | undefined,
  prefersDarkMode: boolean
): ThemeMode => {
  if (isThemeMode(persistedMode)) {
    return persistedMode;
  }

  return prefersDarkMode ? 'dark' : 'light';
};

// Visual payload changes to KERN-derived tokens, not the public runtime contract.
export const getThemeDisplayName = (themeName: AppThemeName): string => {
  switch (themeName) {
    case 'sva-forest':
      return 'KERN Studio Wald';
    case 'sva-default':
    default:
      return 'KERN Studio';
  }
};
