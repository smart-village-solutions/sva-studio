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
        targetRoleIds: ['11111111-1111-4111-8111-111111111111'],
        targetGroupIds: ['22222222-2222-4222-8222-222222222222'],
      })
    ).toMatchObject({
      status: 'draft',
      targetRoleIds: ['11111111-1111-4111-8111-111111111111'],
      targetGroupIds: ['22222222-2222-4222-8222-222222222222'],
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
        targetRoleIds: ['33333333-3333-4333-8333-333333333333'],
        targetGroupIds: ['44444444-4444-4444-8444-444444444444'],
      })
    ).toMatchObject({
      status: 'archived',
      targetRoleIds: ['33333333-3333-4333-8333-333333333333'],
      targetGroupIds: ['44444444-4444-4444-8444-444444444444'],
    });
  });

  it('rejects blank target ids in create and update payloads', () => {
    expect(() =>
      createLegalTextSchema.parse({
        name: 'Datenschutz',
        legalTextVersion: 'v1',
        locale: 'de',
        contentHtml: '<p>Hallo</p>',
        targetRoleIds: ['11111111-1111-4111-8111-111111111111', ''],
      })
    ).toThrow();

    expect(() =>
      updateLegalTextSchema.parse({
        targetGroupIds: ['22222222-2222-4222-8222-222222222222', '   '],
      })
    ).toThrow();
  });
});
