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
      { href: '/admin/content', label: 'Inhalte' },
      { label: 'News-Eintrag anlegen' },
    ]);
  });

  it('returns edit breadcrumbs for dynamic news pages', () => {
    expect(resolveBreadcrumbItems('/admin/news/content-1')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/content', label: 'Inhalte' },
      { label: 'News-Eintrag bearbeiten' },
    ]);
  });

  it('returns content breadcrumbs for event create and edit pages', () => {
    expect(resolveBreadcrumbItems('/admin/events/new')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/content', label: 'Inhalte' },
      { label: 'Event anlegen' },
    ]);

    expect(resolveBreadcrumbItems('/admin/events/event-1')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/content', label: 'Inhalte' },
      { label: 'Event bearbeiten' },
    ]);
  });

  it('returns content breadcrumbs for POI create and edit pages', () => {
    expect(resolveBreadcrumbItems('/admin/poi/new')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/content', label: 'Inhalte' },
      { label: 'POI anlegen' },
    ]);

    expect(resolveBreadcrumbItems('/admin/poi/poi-1')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/content', label: 'Inhalte' },
      { label: 'POI bearbeiten' },
    ]);
  });

  it('falls back to overview for unknown paths', () => {
    expect(resolveBreadcrumbItems('/unbekannt')).toEqual([{ label: 'Übersicht' }]);
  });

  it('returns monitoring job breadcrumbs for list and detail pages', () => {
    expect(resolveBreadcrumbItems('/monitoring/jobs')).toEqual([
      { href: '/', label: 'Übersicht' },
      { label: 'Monitoring Jobs' },
    ]);

    expect(resolveBreadcrumbItems('/monitoring/jobs/job-1')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/monitoring/jobs', label: 'Monitoring Jobs' },
      { label: 'Job-Details' },
    ]);
  });

  it('returns IAM governance and DSR detail breadcrumbs', () => {
    expect(resolveBreadcrumbItems('/admin/iam/governance/case-1')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/iam', label: 'IAM Transparenz-Cockpit' },
      { label: 'Governance-Detail' },
    ]);

    expect(resolveBreadcrumbItems('/admin/iam/dsr/case-2')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/admin/iam', label: 'IAM Transparenz-Cockpit' },
      { label: 'Datenschutzfall-Detail' },
    ]);
  });

  it('returns account rules breadcrumbs', () => {
    expect(resolveBreadcrumbItems('/account/rules')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/account', label: 'Mein Konto' },
      { label: 'Kontoregeln' },
    ]);
  });

  it('returns account privacy detail breadcrumbs', () => {
    expect(resolveBreadcrumbItems('/account/privacy/case-1')).toEqual([
      { href: '/', label: 'Übersicht' },
      { href: '/account', label: 'Mein Konto' },
      { href: '/account/privacy', label: 'Datenschutz & Transparenz' },
      { label: 'Datenschutzfall-Detail' },
    ]);
  });
});
