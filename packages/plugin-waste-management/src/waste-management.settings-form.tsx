import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import type { FormEvent } from 'react';

import { WasteSettingsManagedFields } from './waste-management.settings-managed-fields.js';
import { WasteSettingsCustomRecurrenceSection } from './waste-management.settings-custom-recurrence-section.js';
import type { SettingsFormState } from './waste-management.settings.shared.js';
export type {
  CustomRecurrencePresetInputState,
  DeletedPresetFallbackState,
  SettingsFormState,
} from './waste-management.settings.shared.js';

export const WasteSettingsForm = ({
  form,
  saving,
  onSubmit,
  onChange,
}: {
  readonly form: SettingsFormState;
  readonly saving: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onChange: (next: SettingsFormState | ((current: SettingsFormState) => SettingsFormState)) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pt('settings.groupTitle')}</h3>
          <p className="text-sm text-muted-foreground">{pt('settings.groupDescription')}</p>
        </div>
        <WasteSettingsManagedFields form={form} pt={pt} onChange={onChange} />
        <p className="text-xs text-muted-foreground">{pt('settings.messages.connectionManagedHint')}</p>
      </div>
      <WasteSettingsCustomRecurrenceSection
        items={form.customRecurrencePresets}
        deletedPresetFallbacks={form.deletedPresetFallbacks}
        onChange={(customRecurrencePresets, deletedPresetFallbacks) =>
          onChange((current) => ({ ...current, customRecurrencePresets, deletedPresetFallbacks }))
        }
      />
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? pt('settings.actions.saving') : pt('settings.actions.save')}
        </Button>
      </div>
    </form>
  );
};
