import { describe, expect, it } from 'vitest';

import { pluginNewsTranslations } from '../src/plugin.translations.js';

describe('pluginNewsTranslations', () => {
  it('keeps the canonical de/en news copy', () => {
    expect(pluginNewsTranslations.de.news.navigation.title).toBe('Nachrichten');
    expect(pluginNewsTranslations.de.news.list.description).toBe(
      'Verwalten Sie Nachrichten über das Plugin.'
    );
    expect(pluginNewsTranslations.de.news.fields.title).toBe('Überschrift');
    expect(pluginNewsTranslations.de.news.fields.headline).toBe('Überschrift');
    expect(pluginNewsTranslations.de.news.fields.contentIntro).toBe('Einleitung');
    expect(pluginNewsTranslations.de.news.cards.settings.publication.title).toBe(
      'Veröffentlichung'
    );
    expect(pluginNewsTranslations.de.news.filters.editorialStatus.label).toBe(
      'Redaktioneller Status'
    );
    expect(pluginNewsTranslations.de.news.history.columns.summary).toBe('Zusammenfassung');
    expect(pluginNewsTranslations.de.news.messages.errors.csrfValidationFailed).toBe(
      'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.'
    );

    expect(pluginNewsTranslations.en.news.list.description).toBe(
      'Manage news entries through the plugin.'
    );
    expect(pluginNewsTranslations.en.news.cards.settings.publication.title).toBe('Publication');
    expect(pluginNewsTranslations.en.news.filters.editorialStatus.label).toBe('Editorial status');
    expect(pluginNewsTranslations.en.news.history.columns.summary).toBe('Summary');
    expect(pluginNewsTranslations.en.news.messages.errors.csrfValidationFailed).toBe(
      'Security validation failed. Please reload the page and try again.'
    );
  });
});
