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
    <div>settings-status-panel:{settings?.holidayStateCode ?? 'no-state'}</div>
  ),
}));

vi.mock('../src/waste-management.settings-form.js', () => ({
  WasteSettingsForm: ({
    form,
    onChange,
    onSubmit,
  }: {
    readonly form: { holidayStateCode?: string; calendarWebUrl?: string; selectedInterfaceId?: string };
    readonly onChange: (next: unknown) => void;
    readonly onSubmit: () => void;
  }) => {
    capturedForms.push(form);
    return (
      <div>
        <div>{form.holidayStateCode ?? 'unset'}</div>
        <div>{form.calendarWebUrl ?? 'unset-url'}</div>
        <button
          type="button"
          onClick={() => onChange((current: { holidayStateCode?: string }) => ({ ...current, holidayStateCode: 'BB' }))}
        >
          change-holiday-state
        </button>
        <button type="button" onClick={onSubmit}>
          save-settings
        </button>
      </div>
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
  it('does not render the technical status panel in settings view', async () => {
    getWasteManagementSettingsMock.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      holidayStateCode: 'NW',
      customRecurrencePresets: [],
    });

    render(<WasteSettingsPanel />);

    await waitFor(() => {
      expect(capturedForms.at(-1)).toEqual(expect.objectContaining({ holidayStateCode: 'NW' }));
    });

    expect(screen.queryByText('settings-status-panel:NW')).toBeNull();
  });

  it('loads the calendar web url and persists it through the global save action', async () => {
    getWasteManagementSettingsMock.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
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
      selectedInterfaceId: 'supabase-1',
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      holidayStateCode: 'NW',
      lastHolidaySyncStatus: 'partial_success',
      customRecurrencePresets: [],
    });

    render(<WasteSettingsPanel />);

    await waitFor(() => {
      expect(capturedForms.at(-1)).toEqual(
        expect.objectContaining({
          holidayStateCode: 'NW',
          calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
          selectedInterfaceId: 'supabase-1',
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'save-settings' }));

    await waitFor(() => {
      expect(updateWasteManagementSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          holidayStateCode: 'NW',
          calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
          selectedInterfaceId: 'supabase-1',
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('settings.messages.saveSuccessWithHolidaySync:{"status":"partial_success"}')).toBeTruthy();
    });
  });

  it('saves the holiday state after the global save action', async () => {
    getWasteManagementSettingsMock.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
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
      selectedInterfaceId: 'supabase-1',
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      holidayStateCode: 'BB',
      lastHolidaySyncStatus: 'success',
      customRecurrencePresets: [],
    });

    render(<WasteSettingsPanel />);

    await waitFor(() => {
      expect(capturedForms.at(-1)).toEqual(expect.objectContaining({ holidayStateCode: 'NW' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'change-holiday-state' }));

    expect(updateWasteManagementSettingsMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'save-settings' }));

    await waitFor(() => {
      expect(updateWasteManagementSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          holidayStateCode: 'BB',
          selectedInterfaceId: 'supabase-1',
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('settings.messages.saveSuccessWithHolidaySync:{"status":"success"}')).toBeTruthy();
    });
  });
});
