import { describe, expect, it } from 'vitest';

import { createRoleKeyBase, createRoleKeyCandidate } from './role-key.js';

describe('role key generation', () => {
  it.each([
    ['Redaktion & Öffentlichkeit', 'redaktion_oeffentlichkeit'],
    ['  Straße Übergröße  ', 'strasse_uebergroesse'],
    ['Équipe Actualités', 'equipe_actualites'],
    ['🎉', 'rolle'],
    ['IT', 'rolle_it'],
  ])('normalizes %s to %s', (displayName, expected) => {
    expect(createRoleKeyBase(displayName)).toBe(expected);
  });

  it('keeps collision suffixes within the key length limit', () => {
    const base = createRoleKeyBase('A'.repeat(100));

    expect(createRoleKeyCandidate(base, 2)).toBe(`${'a'.repeat(62)}_2`);
    expect(createRoleKeyCandidate(base, 12)).toBe(`${'a'.repeat(61)}_12`);
  });
});
