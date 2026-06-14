import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWasteToolsViewModel } from '../src/use-waste-tools-view-model.js';

const getWasteManagementImportCatalogMock = vi.hoisted(() => vi.fn());
const createWasteToolsViewModelMock = vi.hoisted(() => vi.fn());
const useWasteToolsViewModelHelpersMock = vi.hoisted(() => vi.fn());
const useWasteTechnicalHistoryMock = vi.hoisted(() => vi.fn());
const useWasteTrackedJobMock = vi.hoisted(() => vi.fn());
const useWasteImportStateMock = vi.hoisted(() => vi.fn());
const useWasteMaintenanceStateMock = vi.hoisted(() => vi.fn());

vi.mock('../src/waste-management.api.js', () => ({
  getWasteManagementImportCatalog: (...args: Parameters<typeof getWasteManagementImportCatalogMock>) =>
    getWasteManagementImportCatalogMock(...args),
}));

vi.mock('../src/waste-management.tools.actions.js', () => ({
  createWasteToolsViewModel: (...args: Parameters<typeof createWasteToolsViewModelMock>) =>
    createWasteToolsViewModelMock(...args),
  useWasteToolsViewModelHelpers: (...args: Parameters<typeof useWasteToolsViewModelHelpersMock>) =>
    useWasteToolsViewModelHelpersMock(...args),
}));

vi.mock('../src/waste-management.tools.history-state.js', () => ({
  useWasteTechnicalHistory: (...args: Parameters<typeof useWasteTechnicalHistoryMock>) =>
    useWasteTechnicalHistoryMock(...args),
}));

vi.mock('../src/waste-management.tools.job-state.js', () => ({
  useWasteTrackedJob: (...args: Parameters<typeof useWasteTrackedJobMock>) => useWasteTrackedJobMock(...args),
}));

vi.mock('../src/use-waste-tools-state.ts', () => ({
  useWasteImportState: (...args: Parameters<typeof useWasteImportStateMock>) => useWasteImportStateMock(...args),
  useWasteMaintenanceState: (...args: Parameters<typeof useWasteMaintenanceStateMock>) =>
    useWasteMaintenanceStateMock(...args),
}));

describe('useWasteToolsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the tools view model from the composed state bundles and job tracking hooks', () => {
    const importCatalog = [{ profileId: 'profile-1', sourceFormats: ['text/csv'] }];
    const importState = {
      importProfileId: 'profile-1',
      importSourceFormat: 'text/csv',
      importBlobRef: 'blob-1',
      importDryRun: false,
      delimiterOverride: ';',
      previewResult: null,
      previewReady: true,
      setImportProfileId: vi.fn(),
      setImportSourceFormat: vi.fn(),
      setImportBlobRef: vi.fn(),
      setImportDryRun: vi.fn(),
      setDelimiterOverride: vi.fn(),
      setPreviewResult: vi.fn(),
      setPreviewReady: vi.fn(),
    };
    const maintenanceState = {
      migrationSchema: 'public',
      migrationVersion: '1.2.3',
      resetToken: 'reset-1',
      resetConfirmOpen: true,
      runningAction: 'import',
      message: { kind: 'success', text: 'ok' },
      lastJob: { id: 'job-1' },
      setMigrationSchema: vi.fn(),
      setMigrationVersion: vi.fn(),
      setResetToken: vi.fn(),
      setResetConfirmOpen: vi.fn(),
      setRunningAction: vi.fn(),
      setMessage: vi.fn(),
      setLastJob: vi.fn(),
    };
    const technicalHistory = [{ id: 'history-1' }];
    const refreshTechnicalHistory = vi.fn(async () => undefined);
    const actions = { runImport: vi.fn() };
    const selectedImportProfile = { profileId: 'profile-1' };
    const runDeleteHistoryEntry = vi.fn();
    const expectedViewModel = { id: 'view-model' };

    getWasteManagementImportCatalogMock.mockReturnValue(importCatalog);
    useWasteImportStateMock.mockReturnValue(importState);
    useWasteMaintenanceStateMock.mockReturnValue(maintenanceState);
    useWasteTechnicalHistoryMock.mockReturnValue({
      technicalHistory,
      refreshTechnicalHistory,
    });
    useWasteToolsViewModelHelpersMock.mockReturnValue({
      selectedImportProfile,
      actions,
      runDeleteHistoryEntry,
    });
    createWasteToolsViewModelMock.mockReturnValue(expectedViewModel);

    const { result } = renderHook(() => useWasteToolsViewModel((key) => key));

    expect(useWasteToolsViewModelHelpersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pt: expect.any(Function),
        importCatalog,
        importProfileId: 'profile-1',
        lastJob: maintenanceState.lastJob,
      })
    );
    expect(useWasteTrackedJobMock).toHaveBeenCalledWith({
      lastJob: maintenanceState.lastJob,
      refreshTechnicalHistory,
      setLastJob: maintenanceState.setLastJob,
    });
    expect(createWasteToolsViewModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        importCatalog,
        technicalHistory,
        selectedImportProfile,
        actions,
        runDeleteHistoryEntry,
        importProfileId: importState.importProfileId,
        importSourceFormat: importState.importSourceFormat,
        importBlobRef: importState.importBlobRef,
        migrationSchema: maintenanceState.migrationSchema,
        migrationVersion: maintenanceState.migrationVersion,
        lastJob: maintenanceState.lastJob,
      })
    );
    expect(result.current).toBe(expectedViewModel);
  });
});
