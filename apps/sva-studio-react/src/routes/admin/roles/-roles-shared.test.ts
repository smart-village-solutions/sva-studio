import { describe, expect, it } from 'vitest';

import { getRoleDeleteConfirmationContent } from './-roles-shared';

describe('role shared helpers', () => {
  it('returns the centralized delete confirmation content for cascading role removal', () => {
    expect(getRoleDeleteConfirmationContent()).toEqual({
      title: 'Rolle löschen',
      description:
        'Beim Löschen werden bestehende Benutzer- und Gruppenzuordnungen dieser Rolle entfernt und anschließend die Rolle dauerhaft gelöscht.',
      confirmLabel: 'Rolle löschen',
    });
  });
});
