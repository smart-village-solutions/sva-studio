import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

import type { CustomRecurrencePresetInputState } from './waste-management.settings.shared.js';

type DraftRowProps = {
  readonly saving: boolean;
  readonly onAdd: () => void;
};

export const WasteSettingsCustomRecurrenceDraftRow = ({
  saving,
  onAdd,
}: Readonly<DraftRowProps>) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div>
      <Button type="button" variant="outline" disabled={saving} onClick={onAdd}>
        {pt('settings.actions.addCustomRecurrence')}
      </Button>
    </div>
  );
};

type PresetTableProps = {
  readonly items: readonly CustomRecurrencePresetInputState[];
  readonly saving: boolean;
  readonly onEdit: (item: CustomRecurrencePresetInputState) => void;
  readonly onDelete: (item: CustomRecurrencePresetInputState) => void;
};

export const WasteSettingsCustomRecurrenceTable = ({
  items,
  saving,
  onEdit,
  onDelete,
}: Readonly<PresetTableProps>) => {
  const pt = usePluginTranslation('wasteManagement');

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{pt('settings.messages.customRecurrencesEmpty')}</p>;
  }

  return (
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
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-2 align-top">{item.name}</td>
              <td className="px-3 py-2 align-top">
                {pt('settings.meta.customRecurrenceIntervalDays', { value: item.intervalDays })}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" disabled={saving} onClick={() => onEdit(item)}>
                    {pt('settings.actions.editCustomRecurrence')}
                  </Button>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => onDelete(item)}>
                    {pt('settings.actions.deleteCustomRecurrence')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
