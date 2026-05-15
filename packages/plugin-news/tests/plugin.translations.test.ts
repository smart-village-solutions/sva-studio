import { describe, expect, it } from 'vitest';

import { pluginNewsTranslations } from '../src/plugin.translations.js';

describe('pluginNewsTranslations', () => {
  it('keeps the canonical de/en news copy', () => {
    expect(pluginNewsTranslations.de.news.list.description).toBe(
      'Verwalten Sie News-Einträge über das Plugin.'
    );
    expect(pluginNewsTranslations.de.news.fields.categoriesHelp).toBe(
      'Eine Kategorie pro Zeile.'
    );
    expect(pluginNewsTranslations.de.news.messages.errors.csrfValidationFailed).toBe(
      'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.'
    );

    expect(pluginNewsTranslations.en.news.list.description).toBe(
      'Manage news entries through the plugin.'
    );
    expect(pluginNewsTranslations.en.news.fields.categoriesHelp).toBe(
      'One category per line.'
    );
    expect(pluginNewsTranslations.en.news.messages.errors.csrfValidationFailed).toBe(
      'Security validation failed. Please reload the page and try again.'
    );
  });
});
