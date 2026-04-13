import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { usePluginTranslation } from '@sva/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '../i18n';
import { LOCALE_STORAGE_KEY, LocaleProvider, useLocale } from './locale-provider';

const TranslationProbe = () => {
  return <span>{t('shell.sidebar.account')}</span>;
};

const PluginTranslationProbe = () => {
  const pt = usePluginTranslation('news');
  return <span>{pt('list.title')}</span>;
};

const LocaleSwitchProbe = () => {
  const { locale, setLocale } = useLocale();

  return (
    <button type="button" onClick={() => setLocale('en')}>
      {locale}
    </button>
  );
};

describe('LocaleProvider', () => {
  let storage = new Map<string, string>();

  beforeEach(() => {
    storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
        clear: vi.fn(() => {
          storage.clear();
        }),
      },
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('applies a persisted locale after mount', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');

    render(
      <LocaleProvider>
        <TranslationProbe />
      </LocaleProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('My Account')).toBeTruthy();
      expect(document.documentElement.lang).toBe('en');
    });
  });

  it('persists explicit locale changes', async () => {
    render(
      <LocaleProvider>
        <LocaleSwitchProbe />
      </LocaleProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'de' }));

    await waitFor(() => {
      expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    });
  });

  it('resolves plugin translations on the first render', () => {
    render(
      <LocaleProvider>
        <PluginTranslationProbe />
      </LocaleProvider>
    );

    expect(screen.getByText('News')).toBeTruthy();
  });
});
