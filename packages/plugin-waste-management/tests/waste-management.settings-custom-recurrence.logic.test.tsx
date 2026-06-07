// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useWasteSettingsCustomRecurrenceLogic } from '../src/waste-management.settings-custom-recurrence.logic.js';

describe('useWasteSettingsCustomRecurrenceLogic', () => {
  it('opens a default draft in create mode and sorts items case-insensitively', () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useWasteSettingsCustomRecurrenceLogic({
        items: [
          { id: 'b', name: 'beta', description: '', intervalDays: 14 },
          { id: 'a', name: 'Alpha', description: '', intervalDays: 7 },
        ],
        deletedPresetFallbacks: {},
        onChange,
      })
    );

    expect(result.current.sortedItems.map((item) => item.id)).toEqual(['a', 'b']);

    act(() => {
      result.current.openCreateDialog();
    });

    expect(result.current.dialogMode).toBe('create');
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.editingItem).toEqual(
      expect.objectContaining({
        intervalDays: 7,
      })
    );
  });

  it('saves edited items and resets the dialog state afterwards', () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useWasteSettingsCustomRecurrenceLogic({
        items: [{ id: 'a', name: 'Alpha', description: '', intervalDays: 7 }],
        deletedPresetFallbacks: {},
        onChange,
      })
    );

    act(() => {
      result.current.openEditItem({ id: 'a', name: 'Alpha', description: '', intervalDays: 7 });
    });

    expect(result.current.dialogMode).toBe('edit');

    act(() => {
      result.current.saveItem({ id: 'a', name: 'Alpha neu', description: 'Neu', intervalDays: 10 });
    });

    expect(onChange).toHaveBeenCalledWith(
      [{ id: 'a', name: 'Alpha neu', description: 'Neu', intervalDays: 10 }],
      {}
    );
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.editingItem).toBeNull();
  });

  it('ignores delete confirmations without a selected item', () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useWasteSettingsCustomRecurrenceLogic({
        items: [{ id: 'a', name: 'Alpha', description: '', intervalDays: 7 }],
        deletedPresetFallbacks: {},
        onChange,
      })
    );

    act(() => {
      result.current.confirmDelete(undefined);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes stale fallback references and stores the replacement fallback for deleted presets', () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useWasteSettingsCustomRecurrenceLogic({
        items: [
          { id: 'a', name: 'Alpha', description: '', intervalDays: 7 },
          { id: 'b', name: 'Beta', description: '', intervalDays: 14 },
          { id: 'c', name: 'Gamma', description: '', intervalDays: 21 },
        ],
        deletedPresetFallbacks: {
          b: { kind: 'preset', value: 'a' },
          c: { kind: 'preset', value: 'a' },
        },
        onChange,
      })
    );

    act(() => {
      result.current.setDeletingItem({ id: 'a', name: 'Alpha', description: '', intervalDays: 7 });
    });

    act(() => {
      result.current.confirmDelete({ kind: 'default', value: 'rest' });
    });

    expect(onChange).toHaveBeenCalledWith(
      [
        { id: 'b', name: 'Beta', description: '', intervalDays: 14 },
        { id: 'c', name: 'Gamma', description: '', intervalDays: 21 },
      ],
      {
        a: { kind: 'default', value: 'rest' },
      }
    );
    expect(result.current.deletingItem).toBeNull();
  });
});
