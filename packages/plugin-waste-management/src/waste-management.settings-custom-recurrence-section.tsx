import { usePluginTranslation } from '@sva/plugin-sdk';

import { useWasteSettingsCustomRecurrenceLogic } from './waste-management.settings-custom-recurrence.logic.js';
import type { CustomRecurrencePresetInputState, DeletedPresetFallbackState } from './waste-management.settings.shared.js';
import { WasteSettingsCustomRecurrenceDeleteDialog } from './waste-management.settings-custom-recurrence-delete-dialog.js';
import { WasteSettingsCustomRecurrenceDialog } from './waste-management.settings-custom-recurrence-dialog.js';
import {
  WasteSettingsCustomRecurrenceDraftRow,
  WasteSettingsCustomRecurrenceTable,
} from './waste-management.settings-custom-recurrence.parts.js';

export const WasteSettingsCustomRecurrenceSection = ({
  items,
  deletedPresetFallbacks,
  saving,
  onChange,
}: {
  readonly items: readonly CustomRecurrencePresetInputState[];
  readonly deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>;
  readonly saving: boolean;
  readonly onChange: (
    customRecurrencePresets: readonly CustomRecurrencePresetInputState[],
    deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>
  ) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const controller = useWasteSettingsCustomRecurrenceLogic({
    items,
    deletedPresetFallbacks,
    onChange,
  });

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('settings.messages.customRecurrencesTitle')}</h3>
        <p className="text-sm text-muted-foreground">{pt('settings.messages.customRecurrencesDescription')}</p>
      </div>

      <WasteSettingsCustomRecurrenceDraftRow
        saving={saving}
        onAdd={controller.openCreateDialog}
      />
      <WasteSettingsCustomRecurrenceTable
        items={controller.sortedItems}
        saving={saving}
        onEdit={controller.openEditItem}
        onDelete={controller.setDeletingItem}
      />

      <WasteSettingsCustomRecurrenceDialog
        open={controller.dialogOpen}
        mode={controller.dialogMode}
        value={controller.editingItem}
        onOpenChange={controller.setDialogOpen}
        onSave={controller.saveItem}
      />

      <WasteSettingsCustomRecurrenceDeleteDialog
        open={Boolean(controller.deletingItem)}
        preset={controller.deletingItem}
        availableFallbacks={controller.sortedItems.filter((item) => item.id !== controller.deletingItem?.id)}
        initialFallback={controller.deletingItem ? deletedPresetFallbacks[controller.deletingItem.id] : undefined}
        onOpenChange={(open) => {
          if (!open) {
            controller.setDeletingItem(null);
          }
        }}
        onConfirm={controller.confirmDelete}
      />
    </section>
  );
};
