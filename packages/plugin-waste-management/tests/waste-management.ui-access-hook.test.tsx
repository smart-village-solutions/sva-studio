import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  publishSessionAccessSnapshot,
  resetSessionAccessSnapshot,
} from '@sva/plugin-sdk';

import { useWasteManagementUiAccess } from '../src/waste-management.ui-access.js';

const UiAccessHarness = ({ currentTab = 'fractions' }: { readonly currentTab?: Parameters<typeof useWasteManagementUiAccess>[0] }) => {
  const access = useWasteManagementUiAccess(currentTab);

  return (
    <div>
      <div data-testid="resolved">{access.isResolved ? 'yes' : 'no'}</div>
      <div data-testid="tabs">{access.visibleTabIds.join(',')}</div>
    </div>
  );
};

describe('waste-management ui access hook', () => {
  beforeEach(() => {
    resetSessionAccessSnapshot();
  });

  afterEach(() => {
    resetSessionAccessSnapshot();
  });

  it('derives visible tabs from the shared auth session snapshot without fetching auth/me again', async () => {
    render(<UiAccessHarness currentTab="settings" />);

    expect(screen.getByTestId('resolved').textContent).toBe('no');
    expect(screen.getByTestId('tabs').textContent).toContain('settings');

    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['waste-management.read', 'waste-management.settings.manage', 'waste-management.import.execute'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('resolved').textContent).toBe('yes');
    });

    expect(screen.getByTestId('tabs').textContent).toBe('fractions,tours,locations,scheduling,tools,settings');
  });
});
