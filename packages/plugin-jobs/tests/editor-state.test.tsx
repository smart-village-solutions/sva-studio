import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MainserverApiError, publishSessionAccessSnapshot } from '@sva/plugin-sdk';
import { createJobDefaults } from '../src/contract.js';
import { useJobEditor } from '../src/jobs.editor-state.js';
const api = vi.hoisted(() => ({
  remove: vi.fn(),
  save: vi.fn(),
  get: vi.fn(),
  categories: vi.fn(),
}));
vi.mock('../src/jobs.api.js', async (original) => ({
  ...(await original<object>()),
  saveJob: api.save,
  removeJob: api.remove,
  getJob: api.get,
  listJobCategories: api.categories,
}));
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  api.categories.mockResolvedValue([]);
  publishSessionAccessSnapshot({
    isResolved: true,
    subjectId: 'actor',
    instanceId: 'test',
    assignedModules: ['jobs'],
    roles: [],
    permissionActions: ['jobs.create', 'jobs.update', 'jobs.delete'],
    unscopedPermissionActions: ['jobs.delete'],
  });
});
afterEach(cleanup);
const record = {
  id: '123',
  genericType: 'Job' as const,
  title: 'Road',
  employmentType: 'Vollzeit',
  visible: false,
  updatedAt: '',
  input: { ...createJobDefaults('2026-11-01'), title: 'Road', employmentType: 'Vollzeit' },
  contentFingerprint: 'a'.repeat(64),
};
describe('Job editor operations', () => {
  it('reloads category choices for the selected principal without retaining stale choices', async () => {
    api.categories.mockResolvedValue([{ id: 'org', name: 'Organisation' }]);
    const { result, rerender } = renderHook(
      (principal: 'user' | 'organization') => useJobEditor(undefined, 'principal', principal),
      { initialProps: 'organization' as 'user' | 'organization' }
    );
    await waitFor(() => expect(result.current.categories).toHaveLength(1));
    expect(api.categories).toHaveBeenLastCalledWith('organization');
    api.categories.mockRejectedValueOnce(new Error('unavailable'));
    rerender('user');
    await waitFor(() => expect(result.current.categoryError).toBe(true));
    expect(result.current.categories).toEqual([]);
    expect(api.categories).toHaveBeenLastCalledWith('user');
    api.categories.mockResolvedValue([{ id: 'org', name: 'Organisation' }]);
    rerender('organization');
    await waitFor(() => expect(result.current.categories).toHaveLength(1));
    expect(result.current.categoryError).toBe(false);
  });
  it('keeps the chosen end date when changing the beginning and validates before sending', async () => {
    const { result } = renderHook(() => useJobEditor(undefined, 'test:actor'));
    await act(async () => result.current.save());
    expect(api.save).not.toHaveBeenCalled();
    act(() => result.current.change('dates', [{ dateEnd: '2026-12-20' }]));
    act(() => result.current.change('publicationDate', '2026-11-15'));
    expect(result.current.draft.dates[0]?.dateEnd).toBe('2026-12-20');
  });
  it('recovers the same operation after reload without a second create and stores no form data', async () => {
    api.save.mockRejectedValueOnce(new TypeError('network')).mockResolvedValue(record);
    const first = renderHook(() => useJobEditor(undefined, 'test:actor'));
    act(() => {
      first.result.current.change('employmentType', 'Vollzeit');
      first.result.current.change('title', 'Road');
    });
    await act(async () => first.result.current.save());
    const operationId = api.save.mock.calls[0]?.[3];
    expect(first.result.current.pending?.operationId).toBe(operationId);
    expect(sessionStorage.getItem('jobs:test:actor:user:new')).not.toContain('Road');
    first.unmount();
    const second = renderHook(() => useJobEditor(undefined, 'test:actor'));
    await act(async () => second.result.current.save());
    expect(api.save).toHaveBeenCalledTimes(1);
    await act(async () => second.result.current.recover());
    expect(api.save.mock.calls[1]).toEqual([
      undefined,
      { recover: true, inputHash: expect.any(String) },
      'user',
      operationId,
    ]);
    expect(second.result.current.record?.id).toBe('123');
    expect(second.result.current.pending).toBeUndefined();
  });
  it('keeps a confirmed provider creation locked while local follow-up is incomplete', async () => {
    api.save.mockResolvedValue({ ...record, reconciliationRequired: true });
    const { result } = renderHook(() => useJobEditor(undefined, 'scope'));
    act(() => {
      result.current.change('employmentType', 'Vollzeit');
      result.current.change('title', 'Road');
    });
    await act(async () => result.current.save());
    await act(async () => result.current.save());
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBeDefined();
    expect(result.current.message).toBe('messages.partial');
  });
  it('reads existing dates without replacing missing values with defaults', async () => {
    api.get.mockResolvedValue({
      data: { ...record, input: { ...record.input, dates: [{ dateEnd: '' }] } },
      access: { 'jobs.update': true },
    });
    const { result } = renderHook(() => useJobEditor('123', 'scope'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.draft.dates[0]).toEqual({ dateEnd: '' });
  });
  it('preserves the draft after a concurrent update and allows correction without retrying an unknown outcome', async () => {
    api.get.mockResolvedValue({ data: record, access: { 'jobs.update': true } });
    api.save.mockRejectedValueOnce(new MainserverApiError('job_content_conflict'));
    const { result } = renderHook(() => useJobEditor('123', 'conflict'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.change('employmentType', 'Vollzeit');
      result.current.change('title', 'My changes');
    });
    await act(async () => result.current.save());
    expect(result.current.draft.title).toBe('My changes');
    expect(result.current.pending).toBeUndefined();
    expect(result.current.failure).toBe('errors.job_content_conflict');
  });
  it('never turns a failed detail load into a create request', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useJobEditor('123', 'offline'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.change('employmentType', 'Vollzeit');
      result.current.change('title', 'Changed');
    });
    await act(async () => result.current.save());
    expect(api.save).not.toHaveBeenCalled();
  });
  it('retains changes made while a save response is pending', async () => {
    let complete!: (value: typeof record) => void;
    api.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const { result } = renderHook(() => useJobEditor(undefined, 'later-edit'));
    act(() => {
      result.current.change('employmentType', 'Vollzeit');
      result.current.change('title', 'First');
    });
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.save();
    });
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    act(() => {
      result.current.change('employmentType', 'Vollzeit');
      result.current.change('title', 'Later');
    });
    await act(async () => {
      complete(record);
      await saving;
    });
    expect(result.current.draft.title).toBe('Later');
    expect(result.current.dirty).toBe(true);
  });
  it('does not start an unsafe write when the durable browser marker cannot be saved', async () => {
    const { result } = renderHook(() => useJobEditor(undefined, 'storage-unavailable'));
    await act(async () => result.current.recover());
    act(() => {
      result.current.change('employmentType', 'Vollzeit');
      result.current.change('title', 'Road');
    });
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    try {
      await act(async () => result.current.save());
      expect(api.save).not.toHaveBeenCalled();
      expect(result.current.failure).toBe('messages.saveError');
      expect(result.current.busy).toBe(false);
    } finally {
      storage.mockRestore();
    }
  });
  it.each([
    'forbidden',
    'data_provider_mismatch',
    'data_provider_missing',
    'database_unavailable',
    'identity_provider_unavailable',
    'acting_principal_not_allowed',
    'organization_mainserver_credentials_missing',
    'missing_credentials',
    'partial_credentials',
    'mainserver_data_provider_identity_conflict',
    'job_prewrite_failed',
    'job_media_unavailable',
    'job_not_found',
    'job_incomplete',
    'job_dependents_unsupported',
  ])('keeps an unknown create blocked when recovery is rejected: %s', async (code) => {
    api.save
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new MainserverApiError(code));
    const { result } = renderHook(() => useJobEditor(undefined, 'denied-recovery'));
    act(() => {
      result.current.change('employmentType', 'Vollzeit');
      result.current.change('title', 'Road');
    });
    await act(async () => result.current.save());
    const operation = result.current.pending;
    await act(async () => result.current.recover());
    expect(result.current.pending).toEqual(operation);
    await act(async () => result.current.save());
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(sessionStorage.length).toBe(1);
  });

  it('keeps the draft when a fresh save is rejected for missing permission', async () => {
    api.save.mockRejectedValueOnce(new MainserverApiError('forbidden'));
    const { result } = renderHook(() => useJobEditor(undefined, 'forbidden'));
    act(() => {
      result.current.change('employmentType', 'Vollzeit');
      result.current.change('title', 'Road');
    });
    await act(async () => result.current.save());
    expect(result.current.pending).toBeUndefined();
    expect(result.current.failure).toBe('errors.forbidden');
    expect(result.current.draft.title).toBe('Road');
  });

  it.each([
    'job_prewrite_failed',
    'job_media_unavailable',
    'job_not_found',
    'job_incomplete',
    'job_dependents_unsupported',
  ])('keeps a definite pre-write rejection editable: %s', async (code) => {
    api.save.mockRejectedValueOnce(new MainserverApiError(code)).mockResolvedValue(record);
    const { result } = renderHook(() => useJobEditor(undefined, code));
    act(() => {
      result.current.change('employmentType', 'Vollzeit');
      result.current.change('title', 'Road');
    });
    await act(async () => result.current.save());
    expect(result.current.pending).toBeUndefined();
    expect(sessionStorage.length).toBe(0);
    expect(result.current.draft.title).toBe('Road');
    await act(async () => result.current.save());
    expect(api.save).toHaveBeenCalledTimes(2);
  });
  it.each([
    'data_provider_mismatch',
    'data_provider_missing',
    'database_unavailable',
    'identity_provider_unavailable',
    'acting_principal_not_allowed',
    'organization_mainserver_credentials_missing',
    'missing_credentials',
    'partial_credentials',
    'mainserver_data_provider_identity_conflict',
  ])('retains an editable update after the definitive provider rejection %s', async (code) => {
    api.get.mockResolvedValue({ data: record, access: { 'jobs.update': true } });
    api.save.mockRejectedValueOnce(new MainserverApiError(code)).mockResolvedValue(record);
    const { result } = renderHook(() => useJobEditor('123', code));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.change('title', 'Updated job'));
    await act(async () => result.current.save());
    expect(result.current.pending).toBeUndefined();
    expect(sessionStorage.length).toBe(0);
    expect(result.current.draft.title).toBe('Updated job');
    await act(async () => result.current.save());
    expect(api.save).toHaveBeenCalledTimes(2);
  });
  it('recovers an uncertain delete after reload even when the original record is already absent', async () => {
    api.get.mockResolvedValue({ data: record, access: { 'jobs.delete': true } });
    api.remove
      .mockRejectedValueOnce(new TypeError('lost response'))
      .mockResolvedValue({ id: '123', deleted: true });
    const first = renderHook(() => useJobEditor('123', 'delete-scope'));
    await waitFor(() => expect(first.result.current.record).toBeDefined());
    await act(async () => first.result.current.remove());
    const operation = first.result.current.pending;
    expect(operation?.kind).toBe('delete');
    expect(api.remove).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('jobs:delete-scope:user:123')).not.toContain('Road');
    first.unmount();
    api.get.mockRejectedValue(new Error('not found'));
    const second = renderHook(() => useJobEditor('123', 'delete-scope'));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    await act(async () => second.result.current.recover());
    expect(api.remove.mock.calls[1]).toEqual([
      '123',
      { recover: true, inputHash: operation!.inputHash },
      'user',
      operation!.operationId,
    ]);
    expect(second.result.current.deleted).toBe(true);
    expect(second.result.current.pending).toBeUndefined();
    await act(async () => second.result.current.save());
    expect(api.save).not.toHaveBeenCalled();
  });
});
