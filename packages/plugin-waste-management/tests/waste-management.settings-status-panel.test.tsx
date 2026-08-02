import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSettingsStatusPanel } from '../src/waste-management.settings-status-panel.js';

vi.mock('@sva/plugin-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/plugin-sdk')>();
  return {
    ...actual,
    usePluginTranslation: () => (key: string) => key,
  };
});

afterEach(cleanup);

describe('WasteSettingsStatusPanel', () => {
  it('offers retry only for failed provisioning and exposes no database identifiers', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <WasteSettingsStatusPanel
        settings={{
          instanceId: 'tenant-a',
          provider: 'postgresql',
          schemaName: 'public',
          enabled: false,
          databaseUrlConfigured: true,
          visibleStatus: 'error',
          provisioningStatus: 'failed',
          provisioningErrorCode: 'migration_failed',
          provisioningUpdatedAt: '2026-08-02T10:00:00.000Z',
        }}
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'settings.actions.retryProvisioning' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByText(/migration_failed/u)).toBeTruthy();
    expect(screen.queryByText(/tenant-a|postgresql:\/\//u)).toBeNull();

    rerender(
      <WasteSettingsStatusPanel
        settings={{
          instanceId: 'tenant-a',
          provider: 'postgresql',
          schemaName: 'public',
          enabled: true,
          databaseUrlConfigured: true,
          visibleStatus: 'ok',
          provisioningStatus: 'ready',
        }}
        onRetry={onRetry}
      />
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
