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
      permissionActions: ['news.read', 'news.create'],
      isLoading: false,
      error: null,
    });

    render(<ContentTypePickerPage />);

    expect(screen.getByRole('heading', { name: 'Inhaltstyp wählen' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Erstellungsseite öffnen' }).getAttribute('href')).toBe('/admin/news/new');
    expect(screen.queryByText('Events')).toBeNull();
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
