import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WasteManagementSearchParams } from '../src/search-params.js';
import { WasteTourShiftCreateLink } from '../src/waste-management.tour-shift-create-link.js';

const linkSpy = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, search, to, ...props }: Record<string, unknown>) => {
    linkSpy({ search, to, ...props });
    return (
      <a href={String(to)} {...props}>
        {children as React.ReactNode}
      </a>
    );
  },
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  buttonVariants: ({ variant, size }: { readonly variant?: string; readonly size?: string }) =>
    `${variant ?? 'default'} ${size ?? 'default'}`,
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}));

const search: WasteManagementSearchParams = {
  tab: 'tours',
  masterDataTab: 'locations',
  fractionsView: 'list',
  toursView: 'list',
  locationsView: 'list',
  schedulingView: 'list',
  q: '',
  page: 1,
  pageSize: 25,
  status: 'all',
  tourValidityPeriod: 'all',
  shiftContext: 'all',
  fractionsSortBy: 'name',
  fractionsSortDirection: 'asc',
};

describe('WasteTourShiftCreateLink', () => {
  afterEach(() => {
    cleanup();
    linkSpy.mockReset();
  });

  it('opens the typed prefilled creation route in a safe new tab', () => {
    render(
      <WasteTourShiftCreateLink
        search={search}
        tourId="tour-42"
        originalDate="2026-12-24"
        label="tours.actions.shiftDate"
      />
    );

    const link = screen.getByRole('link', {
      name: 'tours.actions.shiftDate tours.actions.opensInNewTab',
    });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(linkSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/plugins/waste-management',
        target: '_blank',
        rel: 'noopener noreferrer',
        search: expect.objectContaining({
          tab: 'scheduling',
          schedulingView: 'create',
          schedulingEntryType: 'tour-shift',
          schedulingTourId: 'tour-42',
          schedulingOriginalDate: '2026-12-24',
        }),
      })
    );
  });
});
