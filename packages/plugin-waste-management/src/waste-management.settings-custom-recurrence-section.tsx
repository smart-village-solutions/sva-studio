import { useMemo, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

import type { CustomRecurrencePresetInputState, DeletedPresetFallbackState } from './waste-management.settings.shared.js';
import { WasteSettingsCustomRecurrenceDeleteDialog } from './waste-management.settings-custom-recurrence-delete-dialog.js';
import { WasteSettingsCustomRecurrenceDialog } from './waste-management.settings-custom-recurrence-dialog.js';

const CustomRecurrenceCard = ({
  item,
  pt,
  onEdit,
  onDelete,
}: {
  readonly item: CustomRecurrencePresetInputState;
  readonly pt: (key: string, variables?: Record<string, string | number>) => string;
  readonly onEdit: (item: CustomRecurrencePresetInputState) => void;
  readonly onDelete: (item: CustomRecurrencePresetInputState) => void;
}) => (
  <div className="rounded-2xl border border-border bg-background px-4 py-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {pt('settings.meta.customRecurrenceIntervalDays', { value: item.intervalDays })}
        </p>
        {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => onEdit(item)}>
          {pt('settings.actions.editCustomRecurrence')}
        </Button>
        <Button type="button" variant="outline" onClick={() => onDelete(item)}>
          {pt('settings.actions.deleteCustomRecurrence')}
        </Button>
      </div>
    </div>
  </div>
);

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
  const nextDeletedFallbacks = { ...deletedPresetFallbacks };
  if (fallback) {
    nextDeletedFallbacks[deletingItem.id] = fallback;
  } else {
    delete nextDeletedFallbacks[deletingItem.id];
  }

  return {
    items: items.filter((item) => item.id !== deletingItem.id),
    deletedPresetFallbacks: nextDeletedFallbacks,
  };
};

const CustomRecurrenceSectionHeader = ({
  pt,
  onCreate,
}: {
  readonly pt: (key: string) => string;
  readonly onCreate: () => void;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{pt('settings.messages.customRecurrencesTitle')}</h3>
      <p className="text-sm text-muted-foreground">{pt('settings.messages.customRecurrencesDescription')}</p>
    </div>
    <Button type="button" variant="outline" onClick={onCreate}>
      {pt('settings.actions.addCustomRecurrence')}
    </Button>
  </div>
);

const CustomRecurrenceSectionBody = ({
  items,
  pt,
  onEdit,
  onDelete,
}: {
  readonly items: readonly CustomRecurrencePresetInputState[];
  readonly pt: (key: string, variables?: Record<string, string | number>) => string;
  readonly onEdit: (item: CustomRecurrencePresetInputState) => void;
  readonly onDelete: (item: CustomRecurrencePresetInputState) => void;
}) =>
  items.length === 0 ? (
    <p className="text-sm text-muted-foreground">{pt('settings.messages.customRecurrencesEmpty')}</p>
  ) : (
    <div className="space-y-3">
      {items.map((item) => (
        <CustomRecurrenceCard key={item.id} item={item} pt={pt} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );

const CustomRecurrenceSectionDialogs = ({
  dialogOpen,
  dialogMode,
  editingItem,
  deletingItem,
  sortedItems,
  deletedPresetFallbacks,
  onDialogOpenChange,
  onSave,
  onDeleteOpenChange,
  onConfirmDelete,
}: {
  readonly dialogOpen: boolean;
  readonly dialogMode: 'create' | 'edit';
  readonly editingItem: CustomRecurrencePresetInputState | null;
  readonly deletingItem: CustomRecurrencePresetInputState | null;
  readonly sortedItems: readonly CustomRecurrencePresetInputState[];
  readonly deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>;
  readonly onDialogOpenChange: (open: boolean) => void;
  readonly onSave: (value: CustomRecurrencePresetInputState) => void;
  readonly onDeleteOpenChange: (open: boolean) => void;
  readonly onConfirmDelete: (fallback: DeletedPresetFallbackState | undefined) => void;
}) => (
  <>
    <WasteSettingsCustomRecurrenceDialog
      open={dialogOpen}
      mode={dialogMode}
      value={editingItem}
      onOpenChange={onDialogOpenChange}
      onSave={onSave}
    />

    <WasteSettingsCustomRecurrenceDeleteDialog
      open={Boolean(deletingItem)}
      preset={deletingItem}
      availableFallbacks={sortedItems.filter((item) => item.id !== deletingItem?.id)}
      initialFallback={deletingItem ? deletedPresetFallbacks[deletingItem.id] : undefined}
      onOpenChange={onDeleteOpenChange}
      onConfirm={onConfirmDelete}
    />
  </>
);

export const WasteSettingsCustomRecurrenceSection = ({
  items,
  deletedPresetFallbacks,
  onChange,
}: {
  readonly items: readonly CustomRecurrencePresetInputState[];
  readonly deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>;
  readonly onChange: (
    customRecurrencePresets: readonly CustomRecurrencePresetInputState[],
    deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>
  ) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomRecurrencePresetInputState | null>(null);
  const [deletingItem, setDeletingItem] = useState<CustomRecurrencePresetInputState | null>(null);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [items]
  );
  const handleOpenCreateDialog = () => {
    setDialogMode('create');
    setEditingItem(null);
    setDialogOpen(true);
  };
  const handleEditItem = (item: CustomRecurrencePresetInputState) => {
    setDialogMode('edit');
    setEditingItem(item);
    setDialogOpen(true);
  };
  const handleSaveItem = (value: CustomRecurrencePresetInputState) => {
    onChange(upsertCustomRecurrencePreset(items, value), deletedPresetFallbacks);
    setDialogOpen(false);
    setEditingItem(null);
  };
  const handleConfirmDelete = (fallback: DeletedPresetFallbackState | undefined) => {
    if (!deletingItem) {
      return;
    }
    const nextState = removeCustomRecurrencePreset({ items, deletedPresetFallbacks, deletingItem, fallback });
    onChange(nextState.items, nextState.deletedPresetFallbacks);
    setDeletingItem(null);
  };
  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open) {
      setDeletingItem(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-shell">
      <CustomRecurrenceSectionHeader pt={pt} onCreate={handleOpenCreateDialog} />
      <CustomRecurrenceSectionBody items={sortedItems} pt={pt} onEdit={handleEditItem} onDelete={setDeletingItem} />
      <CustomRecurrenceSectionDialogs
        dialogOpen={dialogOpen}
        dialogMode={dialogMode}
        editingItem={editingItem}
        deletingItem={deletingItem}
        sortedItems={sortedItems}
        deletedPresetFallbacks={deletedPresetFallbacks}
        onDialogOpenChange={setDialogOpen}
        onSave={handleSaveItem}
        onDeleteOpenChange={handleDeleteDialogOpenChange}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  );
};
