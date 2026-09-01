import { describe, expect, it } from 'vitest';

import { createPublicWasteTranslator } from './public-waste-translations.js';

describe('public waste translations', () => {
  it('translates the bound-region error in German and English', () => {
    expect(createPublicWasteTranslator('de')('errors.boundRegionUnavailable')).toContain(
      'Die angegebene Region ist ungültig'
    );
    expect(createPublicWasteTranslator('en')('errors.boundRegionUnavailable')).toContain(
      'The specified region is invalid'
    );
    expect(createPublicWasteTranslator('de')('errors.loadFailed')).toContain(
      'konnten nicht geladen werden'
    );
    expect(createPublicWasteTranslator('en')('errors.loadFailed')).toContain(
      'could not be loaded'
    );
  });
});
