import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '../i18n';
import { LOCALE_STORAGE_KEY, LocaleProvider, useLocale } from './locale-provider';

const TranslationProbe = () => {
  return <span>{t('shell.sidebar.account')}</span>;
};

const PluginTranslationProbe = () => {
  const pt = usePluginTranslation('news');
  return (
    <div>
      <span>{pt('list.title')}</span>
      <span>{pt('editor.editTitle')}</span>
      <span>{pt('editor.editDescription')}</span>
      <span>{pt('actions.save')}</span>
      <span>{pt('actions.back')}</span>
      <span>{pt('actions.delete')}</span>
      <span>{pt('tabs.basis.label')}</span>
      <span>{pt('tabs.content.label')}</span>
      <span>{pt('tabs.settings.label')}</span>
      <span>{pt('tabs.history.label')}</span>
      <span>{pt('tabs.basis.title')}</span>
      <span>{pt('tabs.basis.description')}</span>
      <span>{pt('cards.basis.titleCategories.title')}</span>
      <span>{pt('cards.basis.titleCategories.description')}</span>
      <span>{pt('fields.title')}</span>
      <span>{pt('fields.characterCount', { count: 4 })}</span>
      <span>{pt('fields.categories')}</span>
      <span>{pt('fields.categoriesSearchPlaceholder')}</span>
      <span>{pt('fields.categoriesHelp')}</span>
      <span>{pt('actions.addCategory')}</span>
      <span>{pt('cards.basis.authorMeta.title')}</span>
      <span>{pt('cards.basis.authorMeta.description')}</span>
    </div>
  );
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
    expect(screen.getByText('News-Eintrag bearbeiten')).toBeTruthy();
    expect(screen.getByText('Aktualisieren oder löschen Sie den News-Eintrag.')).toBeTruthy();
    expect(screen.getByText('Speichern')).toBeTruthy();
    expect(screen.getByText('Zurück zur Liste')).toBeTruthy();
    expect(screen.getByText('Löschen')).toBeTruthy();
    expect(screen.getByText('Basis')).toBeTruthy();
    expect(screen.getByText('Inhalte')).toBeTruthy();
    expect(screen.getByText('Einstellungen')).toBeTruthy();
    expect(screen.getByText('Historie')).toBeTruthy();
    expect(screen.getByText('Basisdaten')).toBeTruthy();
    expect(
      screen.getByText('Titel, Kategorien, Autor und redaktionelle Metadaten des News-Eintrags.')
    ).toBeTruthy();
    expect(screen.getByText('Titel & Kategorien')).toBeTruthy();
    expect(
      screen.getByText('Pflegen Sie den redaktionellen Titel und ordnen Sie passende Kategorien zu.')
    ).toBeTruthy();
    expect(screen.getAllByText('Titel')).toHaveLength(1);
    expect(screen.getByText('4 Zeichen')).toBeTruthy();
    expect(screen.getByText('Kategorien')).toBeTruthy();
    expect(screen.getByText('Kategorie suchen oder auswählen')).toBeTruthy();
    expect(screen.getAllByText('Wählen Sie keine, eine oder mehrere Kategorien aus.')).toHaveLength(1);
    expect(screen.getByText('Kategorie hinzufügen')).toBeTruthy();
    expect(screen.getByText('Autor & Metadaten')).toBeTruthy();
    expect(screen.getByText('Autorenschaft und zeitliche Einordnung dieses News-Eintrags.')).toBeTruthy();
  });
});
