import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSettingsPanel } from '../src/waste-management.settings-panel.js';

const getWasteManagementSettingsMock = vi.hoisted(() => vi.fn());
const updateWasteManagementSettingsMock = vi.hoisted(() => vi.fn());
const capturedForms = vi.hoisted(() => [] as unknown[]);

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
  wasteManagementMasterDataContract: {
    isWasteHolidayStateCode: (value: string): value is string => value.length > 0,
  },
}));

vi.mock('@sva/studio-ui-react', () => ({
  StudioErrorState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/waste-management.api.js', () => ({
  getWasteManagementSettings: getWasteManagementSettingsMock,
  updateWasteManagementSettings: updateWasteManagementSettingsMock,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) => (message ? <div>{message.text}</div> : null),
  compactOptionalString: (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  },
  resolveApiErrorCode: () => 'unknown',
}));

vi.mock('../src/waste-management.settings-status-panel.js', () => ({
  WasteSettingsStatusPanel: ({ settings }: { readonly settings: { holidayStateCode?: string | undefined } | null }) => (
    <div>{settings?.holidayStateCode ?? 'no-state'}</div>
  ),
}));

vi.mock('../src/waste-management.settings-form.js', () => ({
  WasteSettingsForm: ({
    form,
    onSubmit,
  }: {
    readonly form: { holidayStateCode?: string };
    readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  }) => {
    capturedForms.push(form);
    return (
      <form onSubmit={onSubmit}>
        <div>{form.holidayStateCode ?? 'unset'}</div>
        <button type="submit">submit-settings</button>
      </form>
    );
  },
}));

afterEach(() => {
  cleanup();
  capturedForms.length = 0;
  getWasteManagementSettingsMock.mockReset();
  updateWasteManagementSettingsMock.mockReset();
});

describe('WasteSettingsPanel', () => {
  it('loads the holiday state code and shows a sync-aware success message after save', async () => {
    getWasteManagementSettingsMock.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      holidayStateCode: 'NW',
      customRecurrencePresets: [],
    });
    updateWasteManagementSettingsMock.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      holidayStateCode: 'NW',
      lastHolidaySyncStatus: 'partial_success',
      customRecurrencePresets: [],
    });

    render(<WasteSettingsPanel />);

    await waitFor(() => {
      expect(capturedForms.at(-1)).toEqual(expect.objectContaining({ holidayStateCode: 'NW' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'submit-settings' }));

    await waitFor(() => {
      expect(updateWasteManagementSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({ holidayStateCode: 'NW' })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('settings.messages.saveSuccessWithHolidaySync:{"status":"partial_success"}')).toBeTruthy();
    });
  });
});
