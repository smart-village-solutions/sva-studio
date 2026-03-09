export type ThemeMode = 'light' | 'dark';

export type AppThemeName = 'sva-default' | 'sva-forest';

export const THEME_MODE_STORAGE_KEY = 'sva-studio.theme-mode';
export const DEFAULT_THEME_NAME: AppThemeName = 'sva-default';

const INSTANCE_THEME_MAP = {
  '11111111-1111-1111-8111-111111111111': 'sva-forest',
} as const satisfies Record<string, AppThemeName>;

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

export const getThemeDisplayName = (themeName: AppThemeName): string => {
  switch (themeName) {
    case 'sva-forest':
      return 'SVA Forest';
    case 'sva-default':
    default:
      return 'SVA Studio';
  }
};
