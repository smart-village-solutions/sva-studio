import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  registerPluginTranslationResolver,
  replaceHostMediaReferences,
} from '@sva/plugin-sdk';

import { listNewsCategories } from '../src/news.api.js';
import { NewsDetailPage } from '../src/news.detail-page.js';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    listHostMediaAssets: vi.fn(async () => []),
    listHostMediaReferencesByTarget: vi.fn(async () => []),
    replaceHostMediaReferences: vi.fn(async (input: unknown) => input),
  };
});

vi.mock('../src/news.api.js', async () => {
  const actual = await vi.importActual<typeof import('../src/news.api.js')>('../src/news.api.js');
  return {
    ...actual,
    listNewsCategories: vi.fn(async () => []),
    createNews: vi.fn(),
    deleteNews: vi.fn(),
    getNews: vi.fn(),
    saveNewsEditorItem: vi.fn(),
    updateNewsPartial: vi.fn(),
  };
});

describe('NewsDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'news.messages.loading': 'News werden geladen.',
        'news.messages.validationSummary': 'Bitte prüfen Sie die folgenden Felder:',
        'news.messages.categoryOptionsLoadError': 'Die Kategorien konnten nicht geladen werden.',
        'news.fields.title': 'Titel',
        'news.fields.author': 'Autor',
        'news.fields.categories': 'Kategorien',
        'news.fields.categoriesHelp': 'Kategorien auswählen.',
        'news.fields.categoriesSearch': 'Kategorien suchen',
        'news.fields.categoriesSearchPlaceholder': 'Kategorie suchen',
        'news.fields.characterCount': '{{count}} Zeichen',
        'news.tabs.ariaLabel': 'Detailbereiche',
        'news.tabs.mobileLabel': 'Bereich auswählen',
        'news.tabs.changeLabel': 'Ungespeichert',
        'news.tabs.basis.label': 'Basis',
        'news.tabs.basis.title': 'Basisdaten',
        'news.tabs.basis.description': 'Basisdaten des News-Eintrags.',
        'news.tabs.content.label': 'Inhalte',
        'news.tabs.content.title': 'Inhalte',
        'news.tabs.content.description': 'Inhalte des News-Eintrags.',
        'news.tabs.release.label': 'Freigabe',
        'news.tabs.release.title': 'Freigabe',
        'news.tabs.release.description': 'Freigabe des News-Eintrags.',
        'news.tabs.settings.label': 'Einstellungen',
        'news.tabs.settings.title': 'Einstellungen',
        'news.tabs.settings.description': 'Einstellungen des News-Eintrags.',
        'news.tabs.history.label': 'Historie',
        'news.tabs.history.title': 'Historie',
        'news.tabs.history.description': 'Historie des News-Eintrags.',
        'news.editor.createTitle': 'News-Eintrag anlegen',
        'news.editor.createDescription': 'Erstellen Sie einen neuen News-Eintrag.',
        'news.actions.create': 'News anlegen',
        'news.actions.update': 'Änderungen speichern',
        'news.actions.save': 'Speichern',
        'news.actions.back': 'Zurück zur Liste',
      };
      return labels[key] ?? key;
    });
    vi.mocked(listNewsCategories).mockResolvedValue([]);
    vi.mocked(listHostMediaAssets).mockResolvedValue([]);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValue([]);
    vi.mocked(replaceHostMediaReferences).mockResolvedValue({
      targetType: 'news',
      targetId: 'news-1',
      references: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders exactly one save button in the page header', async () => {
    render(<NewsDetailPage mode="create" initialAuthor="Redaktion" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy();
    });

    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(1);
  });

  it('renders the author as a fixed readonly field when authorship is fixed', async () => {
    render(<NewsDetailPage mode="create" authorControl={{ kind: 'fixed', value: 'Stadt Musterhausen' }} />);

    const authorInput = await screen.findByLabelText('Autor');
    expect((authorInput as HTMLInputElement).value).toBe('Stadt Musterhausen');
    expect(authorInput.getAttribute('readonly')).not.toBeNull();
  });

  it('renders the author as a dropdown when organizations may publish personally', async () => {
    render(
      <NewsDetailPage
        mode="create"
        authorControl={{
          kind: 'selectable',
          value: 'Stadt Musterhausen',
          options: [
            { value: 'Stadt Musterhausen', label: 'Stadt Musterhausen' },
            { value: 'Max Mustermann', label: 'Max Mustermann' },
          ],
        }}
      />
    );

    const authorSelect = await screen.findByRole('combobox', { name: 'Autor' });
    expect((authorSelect as HTMLSelectElement).value).toBe('Stadt Musterhausen');
    expect(Array.from((authorSelect as HTMLSelectElement).options).map((option) => option.textContent)).toEqual([
      'Stadt Musterhausen',
      'Max Mustermann',
    ]);
  });

  it('applies a later author policy update while the author field is still pristine', async () => {
    const { rerender } = render(<NewsDetailPage mode="create" initialAuthor="Max Mustermann" />);

    expect((await screen.findByLabelText('Autor') as HTMLInputElement).value).toBe('Max Mustermann');

    rerender(<NewsDetailPage mode="create" authorControl={{ kind: 'fixed', value: 'Stadt Musterhausen' }} />);

    await waitFor(() => {
      expect((screen.getByLabelText('Autor') as HTMLInputElement).value).toBe('Stadt Musterhausen');
    });
  });
});
