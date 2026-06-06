import { useMemo, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, Select } from '@sva/studio-ui-react';

import {
  createEmptyCustomRecurrencePreset,
  customRecurrenceIntervalDayOptions,
  normalizeCustomRecurrencePresetDraft,
} from './waste-management.settings-custom-recurrence.support.js';
import type { CustomRecurrencePresetInputState, DeletedPresetFallbackState } from './waste-management.settings.shared.js';
import { WasteSettingsCustomRecurrenceDeleteDialog } from './waste-management.settings-custom-recurrence-delete-dialog.js';
import { WasteSettingsCustomRecurrenceDialog } from './waste-management.settings-custom-recurrence-dialog.js';

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

export const WasteSettingsCustomRecurrenceSection = ({
  items,
  deletedPresetFallbacks,
  saving,
  onPersist,
}: {
  readonly items: readonly CustomRecurrencePresetInputState[];
  readonly deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>;
  readonly saving: boolean;
  readonly onPersist: (
    customRecurrencePresets: readonly CustomRecurrencePresetInputState[],
    deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>
  ) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [draft, setDraft] = useState<CustomRecurrencePresetInputState>(createDefaultDraft());
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

  const handleAddDraft = () => {
    if (!draft.name.trim()) {
      return;
    }

    onPersist(
      upsertCustomRecurrencePreset(items, normalizeCustomRecurrencePresetDraft(draft)),
      deletedPresetFallbacks
    );
    setDraft(createDefaultDraft());
  };

  const handleEditItem = (item: CustomRecurrencePresetInputState) => {
    setDialogMode('edit');
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleSaveItem = (value: CustomRecurrencePresetInputState) => {
    onPersist(upsertCustomRecurrencePreset(items, value), deletedPresetFallbacks);
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleConfirmDelete = (fallback: DeletedPresetFallbackState | undefined) => {
    if (!deletingItem) {
      return;
    }
    const nextState = removeCustomRecurrencePreset({ items, deletedPresetFallbacks, deletingItem, fallback });
    onPersist(nextState.items, nextState.deletedPresetFallbacks);
    setDeletingItem(null);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('settings.messages.customRecurrencesTitle')}</h3>
        <p className="text-sm text-muted-foreground">{pt('settings.messages.customRecurrencesDescription')}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px_auto]">
        <Input
          aria-label={pt('settings.fields.customRecurrenceName')}
          value={draft.name}
          onChange={(event) => {
            const nextName = event.target.value;
            setDraft((current) => ({ ...current, name: nextName }));
          }}
          placeholder={pt('settings.fields.customRecurrenceName')}
        />
        <Select
          aria-label={pt('settings.fields.customRecurrenceIntervalDays')}
          value={String(draft.intervalDays)}
          onChange={(event) => {
            const nextIntervalDays = Number(event.currentTarget.value) || 1;
            setDraft((current) => ({ ...current, intervalDays: nextIntervalDays }));
          }}
        >
          {customRecurrenceIntervalDayOptions.map((value) => (
            <option key={value} value={value}>
              {pt('settings.meta.customRecurrenceIntervalDays', { value })}
            </option>
          ))}
        </Select>
        <Button type="button" variant="outline" disabled={!draft.name.trim() || saving} onClick={handleAddDraft}>
          {pt('settings.actions.addCustomRecurrence')}
        </Button>
      </div>

      {sortedItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{pt('settings.messages.customRecurrencesEmpty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{pt('settings.fields.customRecurrenceName')}</th>
                <th className="px-3 py-2 text-left font-medium">{pt('settings.fields.customRecurrenceIntervalDays')}</th>
                <th className="px-3 py-2 text-right font-medium">{pt('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {sortedItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 align-top">{item.name}</td>
                  <td className="px-3 py-2 align-top">
                    {pt('settings.meta.customRecurrenceIntervalDays', { value: item.intervalDays })}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" disabled={saving} onClick={() => handleEditItem(item)}>
                        {pt('settings.actions.editCustomRecurrence')}
                      </Button>
                      <Button type="button" variant="outline" disabled={saving} onClick={() => setDeletingItem(item)}>
                        {pt('settings.actions.deleteCustomRecurrence')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <WasteSettingsCustomRecurrenceDialog
        open={dialogOpen}
        mode={dialogMode}
        value={editingItem}
        onOpenChange={setDialogOpen}
        onSave={handleSaveItem}
      />

      <WasteSettingsCustomRecurrenceDeleteDialog
        open={Boolean(deletingItem)}
        preset={deletingItem}
        availableFallbacks={sortedItems.filter((item) => item.id !== deletingItem?.id)}
        initialFallback={deletingItem ? deletedPresetFallbacks[deletingItem.id] : undefined}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
};
