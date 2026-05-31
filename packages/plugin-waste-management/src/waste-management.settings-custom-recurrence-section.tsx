import { useMemo, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

import type {
  CustomRecurrencePresetInputState,
  DeletedPresetFallbackState,
} from './waste-management.settings-form.js';
import { WasteSettingsCustomRecurrenceDeleteDialog } from './waste-management.settings-custom-recurrence-delete-dialog.js';
import { WasteSettingsCustomRecurrenceDialog } from './waste-management.settings-custom-recurrence-dialog.js';

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

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-shell">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pt('settings.messages.customRecurrencesTitle')}</h3>
          <p className="text-sm text-muted-foreground">{pt('settings.messages.customRecurrencesDescription')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDialogMode('create');
            setEditingItem(null);
            setDialogOpen(true);
          }}
        >
          {pt('settings.actions.addCustomRecurrence')}
        </Button>
      </div>

      {sortedItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{pt('settings.messages.customRecurrencesEmpty')}</p>
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-background px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pt('settings.meta.customRecurrenceIntervalDays', { value: item.intervalDays })}
                  </p>
                  {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogMode('edit');
                      setEditingItem(item);
                      setDialogOpen(true);
                    }}
                  >
                    {pt('settings.actions.editCustomRecurrence')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDeletingItem(item)}>
                    {pt('settings.actions.deleteCustomRecurrence')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <WasteSettingsCustomRecurrenceDialog
        open={dialogOpen}
        mode={dialogMode}
        value={editingItem}
        onOpenChange={setDialogOpen}
        onSave={(value) => {
          const nextItems = items.some((item) => item.id === value.id)
            ? items.map((item) => (item.id === value.id ? value : item))
            : [...items, value];
          onChange(nextItems, deletedPresetFallbacks);
          setDialogOpen(false);
          setEditingItem(null);
        }}
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
        onConfirm={(fallback) => {
          if (!deletingItem) {
            return;
          }

          const nextDeletedFallbacks = { ...deletedPresetFallbacks };
          if (fallback) {
            nextDeletedFallbacks[deletingItem.id] = fallback;
          } else {
            delete nextDeletedFallbacks[deletingItem.id];
          }

          onChange(
            items.filter((item) => item.id !== deletingItem.id),
            nextDeletedFallbacks,
          );
          setDeletingItem(null);
        }}
      />
    </div>
  );
};
