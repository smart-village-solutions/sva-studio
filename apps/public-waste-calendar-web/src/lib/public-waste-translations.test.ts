import { describe, expect, it } from 'vitest';

import { createPublicWasteTranslator } from './public-waste-translations.js';

describe('public waste translations', () => {
  it('uses the Studio placeholder syntax and defaults to German', () => {
    expect(createPublicWasteTranslator('en-GB')('pdf.downloadYear', { year: 2026 })).toBe(
      'Download PDF for 2026'
    );
    expect(createPublicWasteTranslator('fr')('pdf.downloadYear', { year: 2026 })).toBe(
      'PDF für 2026 herunterladen'
    );
  });

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
    expect(createPublicWasteTranslator('en')('errors.loadFailed')).toContain('could not be loaded');
  });
});
