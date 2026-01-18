export interface AppConfig {
  supportedLanguages: readonly string[];
  defaultLanguage: string;
  theme: {
    defaultMode: 'light' | 'dark';
  };
}

export const appConfig: AppConfig = {
  supportedLanguages: ['de', 'en'] as const,
  defaultLanguage: 'de',
  theme: {
    defaultMode: 'light',
  },
};
