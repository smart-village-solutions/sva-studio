import React from 'react';

import { DEFAULT_LOCALE, isSupportedLocale, setActiveLocale, type SupportedLocale } from '../i18n';

type LocaleContextValue = Readonly<{
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}>;

type LocaleProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export const LOCALE_STORAGE_KEY = 'sva-studio-locale';

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

const resolveInitialLocale = (): SupportedLocale => {
  return DEFAULT_LOCALE;
};

export const LocaleProvider = ({ children }: LocaleProviderProps) => {
  const [locale, setLocaleState] = React.useState<SupportedLocale>(() => {
    const initialLocale = resolveInitialLocale();
    setActiveLocale(initialLocale);
    return initialLocale;
  });

  const setLocale = React.useCallback((nextLocale: SupportedLocale) => {
    setActiveLocale(nextLocale);
    setLocaleState(nextLocale);
  }, []);

  React.useEffect(() => {
    const currentWindow = globalThis.window;
    if (!currentWindow) {
      return;
    }

    const persistedLocale = currentWindow.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!persistedLocale || !isSupportedLocale(persistedLocale) || persistedLocale === locale) {
      return;
    }

    setActiveLocale(persistedLocale);
    setLocaleState(persistedLocale);
  }, []);

  React.useEffect(() => {
    if (globalThis.document) {
      globalThis.document.documentElement.lang = locale;
    }

    if (globalThis.window) {
      globalThis.window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);

  const contextValue = React.useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
    }),
    [locale, setLocale]
  );

  return (
    <LocaleContext.Provider value={contextValue}>
      <React.Fragment key={locale}>{children}</React.Fragment>
    </LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextValue => {
  const context = React.useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }

  return context;
};
