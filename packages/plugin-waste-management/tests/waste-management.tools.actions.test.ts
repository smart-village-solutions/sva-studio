import { describe, expect, it, vi } from 'vitest';

const deleteWasteManagementHistoryJobMock = vi.hoisted(() => vi.fn(async () => undefined));
const previewWasteLocationTourPickupDateImportMock = vi.hoisted(() =>
  vi.fn(async () => ({
    detectedDelimiter: ';',
    delimiter: ';',
    validRowCount: 3,
    invalidRowCount: 0,
    newTours: [],
    summary: {
      locations: { created: 0, existing: 3 },
      assignments: { created: 0, existing: 3 },
    },
    errors: [],
  }))
);
const startWasteManagementResetMock = vi.hoisted(() =>
  vi.fn(async () => ({ id: 'job-reset-1', status: 'queued' }))
);

vi.mock('../src/waste-management.api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/waste-management.api.js')>();
  return {
    ...actual,
    deleteWasteManagementHistoryJob: deleteWasteManagementHistoryJobMock,
    previewWasteLocationTourPickupDateImport: previewWasteLocationTourPickupDateImportMock,
    startWasteManagementReset: startWasteManagementResetMock,
  };
});

import {
  createWasteToolsActions,
  createWasteToolsHistoryDeletionRunner,
  createWasteToolsJobRunner,
} from '../src/waste-management.tools.actions.js';

describe('waste-management tools action helpers', () => {
  it('starts jobs, refreshes history and reports success or mapped errors', async () => {
    const refreshTechnicalHistory = vi.fn(async () => undefined);
    const setRunningAction = vi.fn();
    const setMessage = vi.fn();
    const setLastJob = vi.fn();
    const runner = createWasteToolsJobRunner({
      pt: (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
      refreshTechnicalHistory,
      setRunningAction,
      setMessage,
      setLastJob,
    });

    const job = await runner('import', async () => ({ id: 'job-1' } as never));
    expect(job).toMatchObject({ id: 'job-1' });
    expect(setRunningAction).toHaveBeenNthCalledWith(1, 'import');
    expect(setLastJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));
    expect(refreshTechnicalHistory).toHaveBeenCalledWith(true);
    expect(setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'tools.messages.jobStarted:{"jobId":"job-1"}',
    });
    expect(setRunningAction).toHaveBeenLastCalledWith(null);

    setMessage.mockClear();
    const failed = await runner('seed', async () => {
      throw new Error('kaputt');
    });
    expect(failed).toBeNull();
    expect(setMessage).toHaveBeenLastCalledWith({
      kind: 'error',
      text: 'tools.messages.jobStartError',
    });
  });

  it('deletes history entries, clears the last job when needed, and maps failures', async () => {
    const refreshTechnicalHistory = vi.fn(async () => undefined);
    const setMessage = vi.fn();
    const setLastJob = vi.fn();
    const deleteRunner = createWasteToolsHistoryDeletionRunner({
      pt: (key) => key,
      refreshTechnicalHistory,
      setMessage,
      setLastJob,
    });

    await expect(deleteRunner('job-1', 'job-1')).resolves.toBe(true);
    expect(deleteWasteManagementHistoryJobMock).toHaveBeenCalledWith('job-1');
    expect(setLastJob).toHaveBeenCalledWith(null);
    expect(refreshTechnicalHistory).toHaveBeenCalledWith(true);
    expect(setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'tools.messages.historyDeleteSuccess',
    });

    deleteWasteManagementHistoryJobMock.mockRejectedValueOnce(new Error('delete failed'));
    await expect(deleteRunner('job-2', 'job-1')).resolves.toBe(false);
    expect(setMessage).toHaveBeenLastCalledWith({
      kind: 'error',
      text: 'tools.messages.jobStartError',
    });
  });

  it('guards preview execution, reports preview success or failure, and resets reset-dialog state after reset jobs', async () => {
    const setPreviewResult = vi.fn();
    const setPreviewReady = vi.fn();
    const setMessage = vi.fn();
    const runJob = vi.fn(async (_action, callback: () => Promise<unknown>) => callback());
    const setResetConfirmOpen = vi.fn();
    const setResetToken = vi.fn();
    const actions = createWasteToolsActions({
      pt: (key) => key,
      runJob,
      importProfileId: 'waste-management.ortsbezogene-tourtermine',
      importSourceFormat: 'text/csv',
      importBlobRef: '  data:text/csv;base64,ZmFrZQ==  ',
      importDryRun: false,
      delimiterOverride: ';',
      setPreviewResult,
      setPreviewReady,
      setMessage,
      migrationSchema: '',
      migrationVersion: '',
      resetToken: ' RESET ',
      setResetConfirmOpen,
      setResetToken,
    });

    await expect(actions.runPreview()).resolves.toMatchObject({ delimiter: ';' });
    expect(previewWasteLocationTourPickupDateImportMock).toHaveBeenCalledWith({
      importProfileId: 'waste-management.ortsbezogene-tourtermine',
      sourceFormat: 'text/csv',
      blobRef: 'data:text/csv;base64,ZmFrZQ==',
      delimiterOverride: ';',
    });
    expect(setPreviewResult).toHaveBeenCalledWith(expect.objectContaining({ delimiter: ';' }));
    expect(setPreviewReady).toHaveBeenCalledWith(true);
    expect(setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'tools.messages.previewReady',
    });

    previewWasteLocationTourPickupDateImportMock.mockRejectedValueOnce(new Error('preview failed'));
    await expect(actions.runPreview()).resolves.toBeNull();
    expect(setPreviewResult).toHaveBeenCalledWith(null);
    expect(setPreviewReady).toHaveBeenCalledWith(false);
    expect(setMessage).toHaveBeenLastCalledWith({
      kind: 'error',
      text: 'tools.messages.jobStartError',
    });

    const guardedActions = createWasteToolsActions({
      pt: (key) => key,
      runJob,
      importProfileId: 'waste-management.geografie-abholorte',
      importSourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      importBlobRef: 'blob:import',
      importDryRun: false,
      delimiterOverride: undefined,
      setPreviewResult,
      setPreviewReady,
      setMessage,
      migrationSchema: '',
      migrationVersion: '',
      resetToken: 'RESET',
      setResetConfirmOpen,
      setResetToken,
    });
    await expect(guardedActions.runPreview()).resolves.toBeNull();

    await expect(actions.runReset()).resolves.toMatchObject({ id: 'job-reset-1' });
    expect(startWasteManagementResetMock).toHaveBeenCalledWith({ confirmationToken: 'RESET' });
    expect(setResetConfirmOpen).toHaveBeenCalledWith(false);
    expect(setResetToken).toHaveBeenCalledWith('');
  });
});
