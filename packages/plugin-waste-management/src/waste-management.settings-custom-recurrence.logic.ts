import { useMemo, useState } from 'react';

import { createEmptyCustomRecurrencePreset } from './waste-management.settings-custom-recurrence.support.js';
import type { CustomRecurrencePresetInputState, DeletedPresetFallbackState } from './waste-management.settings.shared.js';

const upsertCustomRecurrencePreset = (
  items: readonly CustomRecurrencePresetInputState[],
  value: CustomRecurrencePresetInputState
): readonly CustomRecurrencePresetInputState[] =>
  items.some((item) => item.id === value.id)
    ? items.map((item) => (item.id === value.id ? value : item))
    : [...items, value];

const removeCustomRecurrencePreset = ({
  items,
  deletedPresetFallbacks,
  deletingItem,
  fallback,
}: {
  readonly items: readonly CustomRecurrencePresetInputState[];
  readonly deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>;
  readonly deletingItem: CustomRecurrencePresetInputState;
  readonly fallback: DeletedPresetFallbackState | undefined;
}) => {
  const nextDeletedFallbacks = Object.fromEntries(
    Object.entries(deletedPresetFallbacks).filter(
      ([presetId, currentFallback]) =>
        presetId !== deletingItem.id &&
        !(currentFallback.kind === 'preset' && currentFallback.value === deletingItem.id)
    )
  ) as Record<string, DeletedPresetFallbackState>;
  if (fallback) {
    nextDeletedFallbacks[deletingItem.id] = fallback;
  }

  return {
    items: items.filter((item) => item.id !== deletingItem.id),
    deletedPresetFallbacks: nextDeletedFallbacks,
  };
};

const createDefaultDraft = (): CustomRecurrencePresetInputState => ({
  ...createEmptyCustomRecurrencePreset(),
  intervalDays: 7,
});

type UseWasteSettingsCustomRecurrenceLogicInput = {
  readonly items: readonly CustomRecurrencePresetInputState[];
  readonly deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>;
  readonly onChange: (
    customRecurrencePresets: readonly CustomRecurrencePresetInputState[],
    deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>
  ) => void;
};

export const useWasteSettingsCustomRecurrenceLogic = ({
  items,
  deletedPresetFallbacks,
  onChange,
}: UseWasteSettingsCustomRecurrenceLogicInput) => {
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomRecurrencePresetInputState | null>(null);
  const [deletingItem, setDeletingItem] = useState<CustomRecurrencePresetInputState | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      ),
    [items]
  );

  const saveItem = (value: CustomRecurrencePresetInputState) => {
    onChange(upsertCustomRecurrencePreset(items, value), deletedPresetFallbacks);
    setDialogOpen(false);
    setEditingItem(null);
  };

  const confirmDelete = (fallback: DeletedPresetFallbackState | undefined) => {
    if (!deletingItem) {
      return;
    }

    const nextState = removeCustomRecurrencePreset({ items, deletedPresetFallbacks, deletingItem, fallback });
    onChange(nextState.items, nextState.deletedPresetFallbacks);
    setDeletingItem(null);
  };

  return {
    dialogMode,
    dialogOpen,
    editingItem,
    deletingItem,
    sortedItems,
    setDialogOpen,
    setDeletingItem,
    saveItem,
    confirmDelete,
    openCreateDialog: () => {
      setDialogMode('create');
      setEditingItem(createDefaultDraft());
      setDialogOpen(true);
    },
    openEditItem: (item: CustomRecurrencePresetInputState) => {
      setDialogMode('edit');
      setEditingItem(item);
      setDialogOpen(true);
    },
  };
};
