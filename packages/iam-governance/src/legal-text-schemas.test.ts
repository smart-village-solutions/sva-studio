import { describe, expect, it } from 'vitest';

import { createLegalTextSchema, updateLegalTextSchema } from './legal-text-schemas.js';

describe('legal-text-schemas', () => {
  it('accepts valid draft payloads and defaults the status', () => {
    expect(
      createLegalTextSchema.parse({
        name: 'Datenschutz',
        legalTextVersion: 'v1',
        locale: 'de',
        contentHtml: '<p>Hallo</p>',
      })
    ).toMatchObject({
      status: 'draft',
    });
  });

  it('requires publishedAt for valid legal texts and rejects invalid dates', () => {
    expect(() =>
      createLegalTextSchema.parse({
        name: 'Datenschutz',
        legalTextVersion: 'v1',
        locale: 'de',
        contentHtml: '<p>Hallo</p>',
        status: 'valid',
      })
    ).toThrow('Veröffentlichungsdatum ist für gültige Rechtstexte erforderlich.');

    expect(() =>
      createLegalTextSchema.parse({
        name: 'Datenschutz',
        legalTextVersion: 'v1',
        locale: 'de',
        contentHtml: '<p>Hallo</p>',
        publishedAt: 'not-a-date',
      })
    ).toThrow('Datum ist ungültig.');
  });

  it('requires at least one update field and accepts nullable parent changes', () => {
    expect(() => updateLegalTextSchema.parse({})).toThrow('Mindestens ein Feld muss gesetzt werden.');

    expect(
      updateLegalTextSchema.parse({
        status: 'archived',
        publishedAt: '2026-05-10T10:00:00.000Z',
      })
    ).toMatchObject({
      status: 'archived',
    });
  });
});
