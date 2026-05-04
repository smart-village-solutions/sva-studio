import { describe, expect, it } from 'vitest';

import './plugins';
import { resolveBreadcrumbItems } from './breadcrumbs';

describe('resolveBreadcrumbItems', () => {
  it('returns content breadcrumbs for canonical admin content paths', () => {
    expect(resolveBreadcrumbItems('/admin/content/content-1')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/content', label: 'Inhalte' },
      { label: 'Inhalt bearbeiten' },
    ]);
  });

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

  it('returns create breadcrumbs for the news plugin', () => {
    expect(resolveBreadcrumbItems('/admin/news/new')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/news', label: 'News' },
      { label: 'News-Eintrag anlegen' },
    ]);
  });

  it('returns edit breadcrumbs for dynamic news pages', () => {
    expect(resolveBreadcrumbItems('/admin/news/content-1')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/news', label: 'News' },
      { label: 'News-Eintrag bearbeiten' },
    ]);
  });

  it('falls back to overview for unknown paths', () => {
    expect(resolveBreadcrumbItems('/unbekannt')).toEqual([{ label: 'Übersicht' }]);
  });
});
