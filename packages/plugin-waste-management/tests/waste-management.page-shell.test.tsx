import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementPage } from '../src/waste-management.page.js';

const navigateMock = vi.fn();
const searchState = {
  tab: 'tools',
  masterDataTab: 'locations',
  q: 'Restmüll',
  page: 3,
  pageSize: 50,
  status: 'active',
  shiftContext: 'tour',
  regionId: undefined,
  cityId: undefined,
  wasteFractionId: undefined,
  tourId: undefined,
};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => searchState,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  StudioOverviewPageTemplate: ({
    title,
    description,
    primaryAction,
    toolbar,
    children,
  }: {
    readonly title: string;
    readonly description: string;
    readonly primaryAction: React.ReactNode;
    readonly toolbar?: React.ReactNode;
    readonly children: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{primaryAction}</div>
      <div>{toolbar}</div>
      <div>{children}</div>
    </section>
  ),
}));

vi.mock('../src/waste-management.page.layout.js', () => ({
  WasteManagementPageToolbar: ({
    onSearchChange,
    onStatusChange,
    onShiftContextChange,
  }: {
    readonly onSearchChange: (value: string) => void;
    readonly onStatusChange: (value: string) => void;
    readonly onShiftContextChange: (value: string) => void;
  }) => (
    <div>
      <button onClick={() => onSearchChange('Bio')}>change-search</button>
      <button onClick={() => onStatusChange('inactive')}>change-status</button>
      <button onClick={() => onShiftContextChange('global')}>change-shift-context</button>
    </div>
  ),
  WasteManagementPageTabs: ({
    onTabChange,
  }: {
    readonly onTabChange: (value: 'overview' | 'settings') => void;
  }) => <button onClick={() => onTabChange('settings')}>change-tab</button>,
  wasteManagementTabTranslationKeyMap: {},
}));

describe('WasteManagementPage shell', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('renders the shell without the global toolbar and resets pagination for tab changes', () => {
    render(<WasteManagementPage />);

    expect(screen.getByText('page.title')).toBeTruthy();
    expect(screen.getByText('page.description')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'change-search' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'change-status' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'change-shift-context' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'actions.openSettings' }));
    expect(navigateMock).toHaveBeenNthCalledWith(1, {
      to: '/plugins/waste-management',
      search: {
        ...searchState,
        tab: 'settings',
        page: 1,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'change-tab' }));
    expect(navigateMock).toHaveBeenNthCalledWith(2, {
      to: '/plugins/waste-management',
      search: {
        ...searchState,
        tab: 'settings',
        page: 1,
      },
    });
  });
});
