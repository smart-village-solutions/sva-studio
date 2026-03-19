import React from 'react';

import { DEFAULT_LOCALE, getActiveLocale, isSupportedLocale, setActiveLocale, type SupportedLocale } from '../i18n';

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
  if (typeof window === 'undefined') {
    return getActiveLocale();
  }

  const persistedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return persistedLocale && isSupportedLocale(persistedLocale) ? persistedLocale : DEFAULT_LOCALE;
};

export const LocaleProvider = ({ children }: LocaleProviderProps) => {
  const [locale, setLocaleState] = React.useState<SupportedLocale>(resolveInitialLocale);

  setActiveLocale(locale);

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);

  return (
    <LocaleContext.Provider
      value={{
        locale,
        setLocale: setLocaleState,
      }}
    >
      {children}
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
