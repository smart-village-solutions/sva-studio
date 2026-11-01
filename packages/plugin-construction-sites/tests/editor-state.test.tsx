import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MainserverApiError, publishSessionAccessSnapshot } from '@sva/plugin-sdk';
import { createConstructionSiteDefaults } from '../src/contract.js';
import { useConstructionSiteEditor } from '../src/construction-sites.editor-state.js';
const api = vi.hoisted(() => ({ save: vi.fn(), get: vi.fn(), categories: vi.fn() }));
vi.mock('../src/construction-sites.api.js', async (original) => ({
  ...(await original<object>()),
  saveConstructionSite: api.save,
  getConstructionSite: api.get,
  listConstructionSiteCategories: api.categories,
}));
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  api.categories.mockResolvedValue([]);
  publishSessionAccessSnapshot({
    isResolved: true,
    subjectId: 'actor',
    instanceId: 'test',
    assignedModules: ['construction-sites'],
    roles: [],
    permissionActions: ['construction-sites.create', 'construction-sites.update'],
  });
});
afterEach(cleanup);
const record = {
  id: '123',
  genericType: 'ConstructionSite' as const,
  title: 'Road',
  visible: false,
  updatedAt: '',
  input: { ...createConstructionSiteDefaults('2026-11-01'), title: 'Road' },
  contentFingerprint: 'a'.repeat(64),
};
describe('construction site editor operations', () => {
  it('reloads category choices for the selected principal without retaining stale choices', async () => {
    api.categories.mockResolvedValue([{ id: 'org', name: 'Organisation' }]);
    const { result } = renderHook(() =>
      useConstructionSiteEditor(undefined, 'principal', 'organization')
    );
    await waitFor(() => expect(result.current.categories).toHaveLength(1));
    expect(api.categories).toHaveBeenLastCalledWith('organization');
    api.categories.mockRejectedValueOnce(new Error('unavailable'));
    act(() => result.current.setPrincipal('user'));
    await waitFor(() => expect(result.current.categoryError).toBe(true));
    expect(result.current.categories).toEqual([]);
    expect(api.categories).toHaveBeenLastCalledWith('user');
    api.categories.mockResolvedValue([{ id: 'org', name: 'Organisation' }]);
    act(() => result.current.setPrincipal('organization'));
    await waitFor(() => expect(result.current.categories).toHaveLength(1));
    expect(result.current.categoryError).toBe(false);
  });
  it('keeps the chosen end date when changing the beginning and validates before sending', async () => {
    const { result } = renderHook(() => useConstructionSiteEditor(undefined, 'test:actor'));
    await act(async () => result.current.save());
    expect(api.save).not.toHaveBeenCalled();
    act(() => result.current.change('dates', [{ dateStart: '2026-11-01', dateEnd: '2026-12-20' }]));
    act(() =>
      result.current.change('dates', [
        { ...result.current.draft.dates[0]!, dateStart: '2026-11-15' },
      ])
    );
    expect(result.current.draft.dates[0]?.dateEnd).toBe('2026-12-20');
  });
  it('recovers the same operation after reload without a second create and stores no form data', async () => {
    api.save.mockRejectedValueOnce(new TypeError('network')).mockResolvedValue(record);
    const first = renderHook(() => useConstructionSiteEditor(undefined, 'test:actor'));
    act(() => first.result.current.change('title', 'Road'));
    await act(async () => first.result.current.save());
    const operationId = api.save.mock.calls[0]?.[3];
    expect(first.result.current.pending?.operationId).toBe(operationId);
    expect(sessionStorage.getItem('construction-sites:test:actor:user:new')).not.toContain('Road');
    first.unmount();
    const second = renderHook(() => useConstructionSiteEditor(undefined, 'test:actor'));
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
    const { result } = renderHook(() => useConstructionSiteEditor(undefined, 'scope'));
    act(() => result.current.change('title', 'Road'));
    await act(async () => result.current.save());
    await act(async () => result.current.save());
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBeDefined();
    expect(result.current.message).toBe('messages.partial');
  });
  it('reads existing dates without replacing missing values with defaults', async () => {
    api.get.mockResolvedValue({
      data: { ...record, input: { ...record.input, dates: [{ dateStart: '', dateEnd: '' }] } },
      access: { 'construction-sites.update': true },
    });
    const { result } = renderHook(() => useConstructionSiteEditor('123', 'scope'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.draft.dates[0]).toEqual({ dateStart: '', dateEnd: '' });
  });
  it('preserves the draft after a concurrent update and allows correction without retrying an unknown outcome', async () => {
    api.get.mockResolvedValue({ data: record, access: { 'construction-sites.update': true } });
    api.save.mockRejectedValueOnce(new MainserverApiError('construction_site_content_conflict'));
    const { result } = renderHook(() => useConstructionSiteEditor('123', 'conflict'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.change('title', 'My changes'));
    await act(async () => result.current.save());
    expect(result.current.draft.title).toBe('My changes');
    expect(result.current.pending).toBeUndefined();
    expect(result.current.failure).toBe('errors.construction_site_content_conflict');
  });
  it('never turns a failed detail load into a create request', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useConstructionSiteEditor('123', 'offline'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.change('title', 'Changed'));
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
    const { result } = renderHook(() => useConstructionSiteEditor(undefined, 'later-edit'));
    act(() => result.current.change('title', 'First'));
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.save();
    });
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    act(() => result.current.change('title', 'Later'));
    await act(async () => {
      complete(record);
      await saving;
    });
    expect(result.current.draft.title).toBe('Later');
    expect(result.current.dirty).toBe(true);
  });
  it('does not start an unsafe write when the durable browser marker cannot be saved', async () => {
    const { result } = renderHook(() =>
      useConstructionSiteEditor(undefined, 'storage-unavailable')
    );
    await act(async () => result.current.recover());
    act(() => result.current.change('title', 'Road'));
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    try {
      await act(async () => result.current.save());
      expect(api.save).not.toHaveBeenCalled();
      expect(result.current.failure).toBe('messages.saveError');
    } finally {
      storage.mockRestore();
    }
  });
  it.each([
    'forbidden',
    'construction_site_prewrite_failed',
    'construction_site_media_unavailable',
    'construction_site_not_found',
    'construction_site_incomplete',
    'construction_site_dependents_unsupported',
  ])('keeps an unknown create blocked when recovery is rejected: %s', async (code) => {
    api.save
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new MainserverApiError(code));
    const { result } = renderHook(() => useConstructionSiteEditor(undefined, 'denied-recovery'));
    act(() => result.current.change('title', 'Road'));
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
    const { result } = renderHook(() => useConstructionSiteEditor(undefined, 'forbidden'));
    act(() => result.current.change('title', 'Road'));
    await act(async () => result.current.save());
    expect(result.current.pending).toBeUndefined();
    expect(result.current.failure).toBe('errors.forbidden');
    expect(result.current.draft.title).toBe('Road');
  });

  it.each([
    'construction_site_prewrite_failed',
    'construction_site_media_unavailable',
    'construction_site_not_found',
    'construction_site_incomplete',
    'construction_site_dependents_unsupported',
  ])('keeps a definite pre-write rejection editable: %s', async (code) => {
    api.save.mockRejectedValueOnce(new MainserverApiError(code)).mockResolvedValue(record);
    const { result } = renderHook(() => useConstructionSiteEditor(undefined, code));
    act(() => result.current.change('title', 'Road'));
    await act(async () => result.current.save());
    expect(result.current.pending).toBeUndefined();
    expect(sessionStorage.length).toBe(0);
    expect(result.current.draft.title).toBe('Road');
    await act(async () => result.current.save());
    expect(api.save).toHaveBeenCalledTimes(2);
  });
});
