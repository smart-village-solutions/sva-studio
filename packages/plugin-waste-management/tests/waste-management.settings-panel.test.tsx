import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSettingsPanel } from '../src/waste-management.settings-panel.js';

const getWasteManagementSettingsMock = vi.hoisted(() => vi.fn());
const updateWasteManagementSettingsMock = vi.hoisted(() => vi.fn());
const retryWasteTenantProvisioningMock = vi.hoisted(() => vi.fn());
const startWasteManagementSyncWasteTypesMock = vi.hoisted(() => vi.fn());
const useWasteTrackedJobMock = vi.hoisted(() => vi.fn());
const capturedForms = vi.hoisted(() => [] as unknown[]);

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
  wasteManagementMasterDataContract: {
    isWasteHolidayStateCode: (value: string): value is string => value.length > 0,
  },
}));

vi.mock('@sva/studio-ui-react', async () => ({
  ...(await vi.importActual<typeof import('@sva/studio-ui-react')>('@sva/studio-ui-react')),
  StudioErrorState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { readonly children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../src/waste-management.api.js', () => ({
  getWasteManagementSettings: getWasteManagementSettingsMock,
  updateWasteManagementSettings: updateWasteManagementSettingsMock,
  retryWasteTenantProvisioning: retryWasteTenantProvisioningMock,
  startWasteManagementSyncWasteTypes: startWasteManagementSyncWasteTypesMock,
}));

vi.mock('../src/waste-management.tools.job-state.js', () => ({
  useWasteTrackedJob: useWasteTrackedJobMock,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({
    message,
    onRetry,
  }: {
    readonly message: { text: string; retryAction?: string } | null;
    readonly onRetry?: (action: string) => void;
  }) =>
    message ? (
      <div>
        {message.text}
        {message.retryAction ? (
          <button
            type="button"
            onClick={() => {
              if (message.retryAction) onRetry?.(message.retryAction);
            }}
          >
            retry-waste-types-sync
          </button>
        ) : null}
      </div>
    ) : null,
  compactOptionalString: (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  },
  resolveApiErrorCode: () => 'unknown',
}));

vi.mock('../src/waste-management.settings-status-panel.js', () => ({
  WasteSettingsStatusPanel: ({
    settings,
    onRetry,
  }: {
    readonly settings: { holidayStateCode?: string; provisioningStatus?: string } | null;
    readonly onRetry?: () => void;
  }) => (
    <div>
      settings-status-panel:{settings?.holidayStateCode ?? 'no-state'}
      {settings?.provisioningStatus === 'failed' ? (
        <button type="button" onClick={onRetry}>
          retry-provisioning
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('../src/waste-management.settings-form.js', () => ({
  WasteSettingsForm: ({
    form,
    onChange,
    onSubmit,
    saveStatus,
  }: {
    readonly form: {
      holidayStateCode?: string;
      calendarWebUrl?: string;
      selectedInterfaceId?: string;
      disruptionLocationEnabled: boolean;
      disruptionAllLocationsEnabled: boolean;
    };
    readonly onChange: (next: unknown) => void;
    readonly onSubmit: () => void;
    readonly saveStatus: string;
  }) => {
    capturedForms.push(form);
    return (
      <div>
        <div>{form.holidayStateCode ?? 'unset'}</div>
        <div>{form.calendarWebUrl ?? 'unset-url'}</div>
        <div>location-disruption:{String(form.disruptionLocationEnabled)}</div>
        <div>all-locations-disruption:{String(form.disruptionAllLocationsEnabled)}</div>
        <button
          type="button"
          onClick={() =>
            onChange((current: { holidayStateCode?: string }) => ({
              ...current,
              holidayStateCode: 'BB',
            }))
          }
        >
          change-holiday-state
        </button>
        <button
          type="button"
          onClick={() =>
            onChange((current: typeof form) => ({
              ...current,
              disruptionLocationEnabled: !current.disruptionLocationEnabled,
            }))
          }
        >
          toggle-location-disruption
        </button>
        <button
          type="button"
          onClick={() =>
            onChange((current: typeof form) => ({
              ...current,
              disruptionAllLocationsEnabled: !current.disruptionAllLocationsEnabled,
            }))
          }
        >
          toggle-all-locations-disruption
        </button>
        <button type="button" onClick={onSubmit}>
          {saveStatus === 'saved' ? 'settings.actions.saved' : 'save-settings'}
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
  retryWasteTenantProvisioningMock.mockReset();
  startWasteManagementSyncWasteTypesMock.mockReset();
  useWasteTrackedJobMock.mockReset();
});

describe('WasteSettingsPanel', () => {
  it('renders the managed provisioning status without exposing interface controls', async () => {
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

    expect(screen.getByText('settings-status-panel:NW')).toBeTruthy();
  });

  it('retries failed provisioning and refreshes the projected status', async () => {
    getWasteManagementSettingsMock
      .mockResolvedValueOnce({
        instanceId: 'tenant-a',
        provider: 'postgresql',
        schemaName: 'public',
        enabled: false,
        databaseUrlConfigured: true,
        visibleStatus: 'error',
        provisioningStatus: 'failed',
        customRecurrencePresets: [],
      })
      .mockResolvedValueOnce({
        instanceId: 'tenant-a',
        provider: 'postgresql',
        schemaName: 'public',
        enabled: false,
        databaseUrlConfigured: true,
        visibleStatus: 'unknown',
        provisioningStatus: 'provisioning',
        customRecurrencePresets: [],
      });
    retryWasteTenantProvisioningMock.mockResolvedValueOnce({ id: 'job-1' });

    render(<WasteSettingsPanel />);
    fireEvent.click(await screen.findByText('retry-provisioning'));

    await waitFor(() => {
      expect(retryWasteTenantProvisioningMock).toHaveBeenCalledOnce();
      expect(screen.getByText('settings.messages.retryProvisioningSuccess')).toBeTruthy();
    });
    expect(screen.queryByText('retry-provisioning')).toBeNull();
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
      data: {
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
      },
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
    expect(await screen.findByRole('button', { name: 'settings.actions.saved' })).toBeTruthy();
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
      data: {
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
      },
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
    expect(await screen.findByRole('button', { name: 'settings.actions.saved' })).toBeTruthy();
  });

  it('keeps both disruption switches independent and offers a retry when synchronization fails', async () => {
    const settings = {
      instanceId: 'tenant-a',
      provider: 'postgresql',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'postgresql-1',
      databaseUrlConfigured: true,
      visibleStatus: 'ok',
      disruptionLocationEnabled: false,
      disruptionAllLocationsEnabled: false,
      customRecurrencePresets: [],
    };
    getWasteManagementSettingsMock.mockResolvedValueOnce(settings);
    updateWasteManagementSettingsMock.mockResolvedValueOnce({
      data: { ...settings, disruptionLocationEnabled: true },
      syncStatus: 'failed',
    });
    startWasteManagementSyncWasteTypesMock.mockResolvedValueOnce({ id: 'job-retry-1' });

    render(<WasteSettingsPanel />);

    expect(await screen.findByText('location-disruption:false')).toBeTruthy();
    expect(screen.getByText('all-locations-disruption:false')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'toggle-location-disruption' }));
    fireEvent.click(screen.getByRole('button', { name: 'save-settings' }));

    await waitFor(() => {
      expect(updateWasteManagementSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          disruptionLocationEnabled: true,
          disruptionAllLocationsEnabled: false,
        })
      );
    });
    expect(await screen.findByText('settings.messages.wasteTypesSyncWarning')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'retry-waste-types-sync' }));
    await waitFor(() => {
      expect(startWasteManagementSyncWasteTypesMock).toHaveBeenCalledOnce();
      expect(screen.getByText('settings.messages.wasteTypesSyncStarted')).toBeTruthy();
    });
  });

  it('tracks an accepted wasteTypes job and exposes terminal failures through the same retry notice', async () => {
    const settings = {
      instanceId: 'tenant-a',
      provider: 'postgresql',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'postgresql-1',
      databaseUrlConfigured: true,
      visibleStatus: 'ok',
      disruptionLocationEnabled: false,
      disruptionAllLocationsEnabled: false,
      customRecurrencePresets: [],
    };
    const syncJob = { id: 'job-waste-types-1', status: 'queued' };
    getWasteManagementSettingsMock.mockResolvedValueOnce(settings);
    updateWasteManagementSettingsMock.mockResolvedValueOnce({
      data: { ...settings, disruptionAllLocationsEnabled: true },
      syncStatus: 'queued',
      syncJob,
    });

    render(<WasteSettingsPanel />);
    await screen.findByText('all-locations-disruption:false');
    fireEvent.click(screen.getByRole('button', { name: 'toggle-all-locations-disruption' }));
    fireEvent.click(screen.getByRole('button', { name: 'save-settings' }));

    await waitFor(() => {
      expect(useWasteTrackedJobMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ lastJob: syncJob })
      );
    });
    const trackedJobOptions = useWasteTrackedJobMock.mock.calls.at(-1)?.[0];
    if (!trackedJobOptions) throw new Error('missing_tracked_job_options');
    trackedJobOptions.onTerminalJob({ ...syncJob, status: 'failed' });

    expect(await screen.findByText('settings.messages.wasteTypesSyncWarning')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'retry-waste-types-sync' })).toBeTruthy();
  });

  it('keeps the polling callback stable across settings panel rerenders', async () => {
    const settings = {
      instanceId: 'tenant-a',
      provider: 'postgresql',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'postgresql-1',
      databaseUrlConfigured: true,
      visibleStatus: 'ok',
      disruptionLocationEnabled: false,
      disruptionAllLocationsEnabled: false,
      customRecurrencePresets: [],
    };
    getWasteManagementSettingsMock.mockResolvedValueOnce(settings);

    render(<WasteSettingsPanel />);
    await screen.findByText('location-disruption:false');
    const initialCallback = useWasteTrackedJobMock.mock.calls.at(-1)?.[0]
      ?.refreshTechnicalHistory;

    fireEvent.click(screen.getByRole('button', { name: 'toggle-location-disruption' }));

    await waitFor(() => {
      expect(useWasteTrackedJobMock.mock.calls.at(-1)?.[0]?.refreshTechnicalHistory).toBe(
        initialCallback
      );
    });
  });

  it('clears the started notice after the tracked wasteTypes job succeeds', async () => {
    const settings = {
      instanceId: 'tenant-a',
      provider: 'postgresql',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'postgresql-1',
      databaseUrlConfigured: true,
      visibleStatus: 'ok',
      disruptionLocationEnabled: false,
      disruptionAllLocationsEnabled: false,
      customRecurrencePresets: [],
    };
    const syncJob = { id: 'job-waste-types-success', status: 'queued' };
    getWasteManagementSettingsMock.mockResolvedValueOnce(settings);
    updateWasteManagementSettingsMock.mockResolvedValueOnce({
      data: { ...settings, disruptionLocationEnabled: true },
      syncStatus: 'queued',
      syncJob,
    });

    render(<WasteSettingsPanel />);
    await screen.findByText('location-disruption:false');
    fireEvent.click(screen.getByRole('button', { name: 'toggle-location-disruption' }));
    fireEvent.click(screen.getByRole('button', { name: 'save-settings' }));
    expect(await screen.findByText('settings.messages.wasteTypesSyncStarted')).toBeTruthy();

    const trackedJobOptions = useWasteTrackedJobMock.mock.calls.at(-1)?.[0];
    if (!trackedJobOptions) throw new Error('missing_tracked_job_options');
    trackedJobOptions.onTerminalJob({ ...syncJob, status: 'succeeded' });

    await waitFor(() => {
      expect(screen.queryByText('settings.messages.wasteTypesSyncStarted')).toBeNull();
    });
  });

  it('retains retryable wasteTypes feedback when holiday synchronization also fails', async () => {
    const settings = {
      instanceId: 'tenant-a',
      provider: 'postgresql',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'postgresql-1',
      databaseUrlConfigured: true,
      visibleStatus: 'ok',
      holidayStateCode: 'NW',
      lastHolidaySyncStatus: 'success',
      disruptionLocationEnabled: false,
      disruptionAllLocationsEnabled: false,
      customRecurrencePresets: [],
    };
    getWasteManagementSettingsMock.mockResolvedValueOnce(settings);
    updateWasteManagementSettingsMock.mockResolvedValueOnce({
      data: {
        ...settings,
        holidayStateCode: 'BB',
        lastHolidaySyncStatus: 'failed',
        disruptionLocationEnabled: true,
      },
      syncStatus: 'failed',
    });

    render(<WasteSettingsPanel />);
    await screen.findByText('location-disruption:false');
    fireEvent.click(screen.getByRole('button', { name: 'change-holiday-state' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle-location-disruption' }));
    fireEvent.click(screen.getByRole('button', { name: 'save-settings' }));

    expect(await screen.findByText('settings.messages.wasteTypesSyncWarning')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'retry-waste-types-sync' })).toBeTruthy();
  });
});
