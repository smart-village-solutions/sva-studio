import { describe, expect, it } from 'vitest';

import { resolveBreadcrumbItems } from './breadcrumbs';

describe('resolveBreadcrumbItems', () => {
  it('returns edit breadcrumbs for dynamic user detail pages', () => {
    expect(resolveBreadcrumbItems('/admin/users/123')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/users', label: 'Benutzerverwaltung' },
      { label: 'Nutzer bearbeiten' },
    ]);
  });

  it('returns role detail breadcrumbs for dynamic role pages', () => {
    expect(resolveBreadcrumbItems('/admin/roles/role-1')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/roles', label: 'Rollenverwaltung' },
      { label: 'Rolle bearbeiten' },
    ]);
  });

  it('falls back to overview for unknown paths', () => {
    expect(resolveBreadcrumbItems('/unbekannt')).toEqual([{ label: 'Übersicht' }]);
  });
});
