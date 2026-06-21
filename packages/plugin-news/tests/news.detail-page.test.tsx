import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listHostMediaReferencesByTarget,
  registerPluginTranslationResolver,
  replaceHostMediaReferences,
} from '@sva/plugin-sdk';

import { listNewsCategories } from '../src/news.api.js';
import { NewsDetailPage } from '../src/news.detail-page.js';

const navigateMock = vi.fn();
const newsDetailSettingsSourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/news.detail-settings-tab.tsx'
);

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
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
        'news.fields.headline': 'Headline',
        'news.fields.contentTeaser': 'Teaser',
        'news.fields.contentBody': 'Inhalt',
        'news.fields.sourceUrl': 'Quell-URL',
        'news.fields.sourceUrlDescription': 'Quellbeschreibung',
        'news.fields.mediaUrl': 'Medien-URL',
        'news.fields.mediaCaption': 'Bildunterschrift',
        'news.fields.publicationMode': 'Veröffentlichungsmodus',
        'news.fields.scheduledPublicationAt': 'Zeitpunkt der Veröffentlichung',
        'news.fields.pushNotification': 'Push-Benachrichtigung senden',
        'news.fields.pushNotificationsSentAt': 'Push gesendet am',
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
        'news.tabs.settings.label': 'Einstellungen',
        'news.tabs.settings.title': 'Einstellungen',
        'news.tabs.settings.description': 'Einstellungen des News-Eintrags.',
        'news.tabs.history.label': 'Historie',
        'news.tabs.history.title': 'Historie',
        'news.tabs.history.description': 'Historie des News-Eintrags.',
        'news.cards.basis.titleCategories.title': 'Titel & Kategorien',
        'news.cards.basis.titleCategories.description': 'Titel und Kategorien.',
        'news.cards.basis.authorMeta.title': 'Autor & Metadaten',
        'news.cards.basis.authorMeta.description': 'Autor und Metadaten.',
        'news.cards.content.text.title': 'Textinhalt',
        'news.cards.content.text.description': 'Textinhalt der News.',
        'news.cards.content.media.title': 'Medien',
        'news.cards.content.media.description': 'Medien des ersten Inhaltsblocks.',
        'news.cards.content.media.empty': 'Noch keine Medien zugeordnet.',
        'news.cards.content.media.itemLabel': 'Medium {{index}}',
        'news.cards.content.source.title': 'Quelle',
        'news.cards.content.source.description': 'Quellenangaben.',
        'news.cards.settings.push.title': 'Push-Benachrichtigungen',
        'news.cards.settings.push.description': 'Push-Hinweise.',
        'news.cards.settings.push.toggleHint': 'Push wird beim Speichern versendet.',
        'news.cards.settings.publication.title': 'Veröffentlichung',
        'news.cards.settings.publication.description': 'Veröffentlichungslogik.',
        'news.cards.settings.publication.scheduleHint': 'Zeitpunkt frei wählbar.',
        'news.cards.history.title': 'Historie',
        'news.cards.history.description': 'Historie der News.',
        'news.publicationModes.draft.label': 'Entwurf',
        'news.publicationModes.draft.description': 'Bleibt unsichtbar.',
        'news.publicationModes.immediate.label': 'Sofort veröffentlichen',
        'news.publicationModes.immediate.description': 'Wird direkt sichtbar.',
        'news.publicationModes.scheduled.label': 'Zeitgesteuert',
        'news.publicationModes.scheduled.description': 'Wird mit Zeitpunkt gespeichert.',
        'news.editor.createTitle': 'News-Eintrag anlegen',
        'news.editor.createDescription': 'Erstellen Sie einen neuen News-Eintrag.',
        'news.actions.create': 'News anlegen',
        'news.actions.update': 'Änderungen speichern',
        'news.actions.save': 'Speichern',
        'news.actions.back': 'Zurück zur Liste',
        'news.actions.addMedia': 'Medium hinzufügen',
        'news.actions.remove': 'Entfernen',
      };
      return labels[key] ?? key;
    });
    vi.mocked(listNewsCategories).mockResolvedValue([]);
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

  it('keeps the author editable when no author policy is provided', async () => {
    render(<NewsDetailPage mode="create" initialAuthor="Max Mustermann" />);

    const authorInput = await screen.findByLabelText('Autor');
    expect(authorInput.getAttribute('readonly')).toBeNull();

    fireEvent.change(authorInput, { target: { value: 'Erika Musterfrau' } });

    expect((authorInput as HTMLInputElement).value).toBe('Erika Musterfrau');
  });

  it('applies a later author policy update while the author field is still pristine', async () => {
    const { rerender } = render(<NewsDetailPage mode="create" initialAuthor="Max Mustermann" />);

    expect((await screen.findByLabelText('Autor') as HTMLInputElement).value).toBe('Max Mustermann');

    rerender(<NewsDetailPage mode="create" authorControl={{ kind: 'fixed', value: 'Stadt Musterhausen' }} />);

    await waitFor(() => {
      expect((screen.getByLabelText('Autor') as HTMLInputElement).value).toBe('Stadt Musterhausen');
    });
  });

  it('renders four editorial tabs and no separate Freigabe tab', async () => {
    render(<NewsDetailPage mode="create" initialAuthor="Redaktion" />);

    await screen.findByRole('tab', { name: 'Basis' });

    expect(screen.getByRole('tab', { name: 'Basis' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Inhalte' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Historie' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Freigabe' })).toBeNull();
  });

  it('shows the scheduled date field only for the scheduled publication mode', async () => {
    render(<NewsDetailPage mode="create" initialAuthor="Redaktion" />);

    fireEvent.change(screen.getByLabelText('Bereich auswählen'), { target: { value: 'settings' } });

    await screen.findByRole('radio', { name: /Zeitgesteuert/ });
    expect(screen.queryByLabelText('Zeitpunkt der Veröffentlichung')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /Zeitgesteuert/ }));

    expect(await screen.findByLabelText('Zeitpunkt der Veröffentlichung')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /Entwurf/ }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Zeitpunkt der Veröffentlichung')).toBeNull();
    });
  });

  it('renders publication mode radio labels through explicit labels and descriptions', () => {
    const source = fs.readFileSync(newsDetailSettingsSourcePath, 'utf8');

    expect(source).toContain('aria-describedby={`publication-mode-${option}-description`}');
    expect(source).toContain('htmlFor={`publication-mode-${option}`}');
    expect(source).toContain('{pt(`publicationModes.${option}.label`)}');
    expect(source).toContain('<p id={`publication-mode-${option}-description`} className="text-muted-foreground">');
    expect(source).toContain('<label');
  });

  it('renders the push notification checkbox through an explicit label binding', () => {
    const source = fs.readFileSync(newsDetailSettingsSourcePath, 'utf8');

    expect(source).toContain('htmlFor="news-push-notification-enabled"');
    expect(source).toContain('id="news-push-notification-enabled"');
    expect(source).toContain('aria-labelledby="news-push-notification-label"');
    expect(source).toContain('id="news-push-notification-label"');
  });
});
