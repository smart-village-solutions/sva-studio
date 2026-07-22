import { describe, expect, it } from 'vitest';

import {
  pluginFaq,
  pluginFaqActionDefinitions,
  pluginFaqPermissionDefinitions,
} from '../src/plugin.js';
import { pluginFaqTranslations } from '../src/plugin.translations.js';

describe('pluginFaq contract', () => {
  it('keeps the canonical standard content contract and translations', () => {
    expect(pluginFaq.navigation).toEqual([
      {
        id: 'faq.navigation',
        to: '/admin/faq',
        titleKey: 'faq.navigation.title',
        section: 'dataManagement',
        requiredAction: 'faq.read',
      },
    ]);
    expect(pluginFaq.actions).toEqual(pluginFaqActionDefinitions);
    expect(pluginFaq.permissions).toEqual(pluginFaqPermissionDefinitions);
    expect(pluginFaq.translations).toEqual(pluginFaqTranslations);
    expect(pluginFaq.adminResources).toEqual([
      expect.objectContaining({
        resourceId: 'faq.content',
        basePath: 'faq',
        contentUi: {
          contentType: 'faq.faq',
          bindings: {
            list: { bindingKey: 'faqList' },
            detail: { bindingKey: 'faqDetail' },
            editor: { bindingKey: 'faqEditor' },
          },
        },
      }),
    ]);
    expect(pluginFaqTranslations.de.faq.fields.languageCode).toBe('Sprachcode');
    expect(pluginFaqTranslations.en.faq.messages.saveError).toBe('Could not save FAQ.');
  });
});
