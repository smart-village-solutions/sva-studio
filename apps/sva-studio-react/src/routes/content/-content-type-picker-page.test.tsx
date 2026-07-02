import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentTypePickerPage } from './-content-type-picker-page';

const useContentAccessMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../hooks/use-content-access', () => ({
  useContentAccess: () => useContentAccessMock(),
}));

vi.mock('../../lib/plugins', () => ({
  studioContentTypes: [
    {
      contentType: 'news.article',
      displayName: 'News',
      description: 'Artikel',
      requiredReadAction: 'news.read',
      requiredCreateAction: 'news.create',
      createPath: '/admin/news/new',
      detailPath: '/admin/news/$id',
    },
    {
      contentType: 'events.event-record',
      displayName: 'Events',
      description: 'Veranstaltungen',
      requiredReadAction: 'events.read',
      requiredCreateAction: 'events.create',
      createPath: '/admin/events/new',
      detailPath: '/admin/events/$id',
    },
    {
      contentType: 'surveys.survey',
      displayName: 'Umfragen',
      description: 'Befragungen',
      requiredReadAction: 'surveys.read',
      requiredCreateAction: 'surveys.create',
      createPath: '/admin/surveys/new',
      detailPath: '/admin/surveys/$id',
    },
  ],
}));

describe('ContentTypePickerPage', () => {
  beforeEach(() => {
    useContentAccessMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders only creatable content types', () => {
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: [],
      },
      permissionActions: ['news.read', 'news.create', 'surveys.read'],
      isLoading: false,
      error: null,
    });

    render(<ContentTypePickerPage />);

    expect(screen.getByRole('heading', { name: 'Inhaltstyp wählen' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /News/i }).getAttribute('href')).toBe('/admin/news/new');
    expect(screen.getByText('Meldungen, Artikel und redaktionelle Beiträge für die App erstellen und pflegen.')).toBeTruthy();
    expect(screen.queryByText('Erstellungsseite öffnen')).toBeNull();
    expect(screen.queryByText('news.article')).toBeNull();
    expect(screen.queryByText('Events')).toBeNull();
    expect(screen.queryByText('Umfragen')).toBeNull();
  });

  it('uses a better fallback description for unknown content types', () => {
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: [],
      },
      permissionActions: ['events.read', 'events.create'],
      isLoading: false,
      error: null,
    });

    render(<ContentTypePickerPage />);

    expect(screen.getByRole('link', { name: /Events/i }).getAttribute('href')).toBe('/admin/events/new');
    expect(screen.getByText('Veranstaltungen im gemeinsamen Inhaltsbereich anlegen und verwalten.')).toBeTruthy();
  });

  it('renders the survey card with the dedicated survey description and route', () => {
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: [],
      },
      permissionActions: ['surveys.read', 'surveys.create'],
      isLoading: false,
      error: null,
    });

    render(<ContentTypePickerPage />);

    expect(screen.getByRole('link', { name: /Umfragen/i }).getAttribute('href')).toBe('/admin/surveys/new');
    expect(
      screen.getByText('Umfragen als weiteren Inhaltstyp anlegen, bearbeiten und in der internen Auswertung begleiten.')
    ).toBeTruthy();
  });

  it('shows an empty state when no content type is creatable', () => {
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'read_only',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        reasonCode: 'content_update_missing',
        organizationIds: [],
        sourceKinds: [],
      },
      permissionActions: ['news.read'],
      isLoading: false,
      error: null,
    });

    render(<ContentTypePickerPage />);

    expect(screen.getByText('Keine anlegbaren Inhaltstypen')).toBeTruthy();
    expect(screen.getByText('Im aktuellen Kontext steht kein Inhaltstyp mit Erstellungsrecht zur Verfügung.')).toBeTruthy();
  });
});
