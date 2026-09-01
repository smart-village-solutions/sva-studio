import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioConfirmDialog, StudioSaveButton, type StudioSaveStatus } from '@sva/studio-ui-react';
import { useState } from 'react';

import { formatUpdatedAt } from './waste-management.page.support.js';
import { WasteSettingsCustomRecurrenceSection } from './waste-management.settings-custom-recurrence-section.js';
import {
  WasteTechnicalConfigurationSection,
  WasteCalendarWebUrlSection,
  WasteHolidayStateSection,
  WasteInterfaceSelectionSection,
  WasteDisruptionNotificationsSection,
} from './waste-management.settings-form.sections.js';
import type { SettingsFormState } from './waste-management.settings.shared.js';
export type {
  CustomRecurrencePresetInputState,
  SettingsFormState,
} from './waste-management.settings.shared.js';

type WasteSettingsFormProps = {
  readonly form: SettingsFormState;
  readonly settings: WasteManagementSettingsRecord | null;
  readonly saving: boolean;
  readonly saveStatus: StudioSaveStatus;
  readonly onChange: (
    next: SettingsFormState | ((current: SettingsFormState) => SettingsFormState)
  ) => void;
  readonly onSubmit: () => void;
};

export const WasteSettingsForm = ({
  form,
  settings,
  saving,
  saveStatus,
  onChange,
  onSubmit,
}: Readonly<WasteSettingsFormProps>) => {
  const pt = usePluginTranslation('wasteManagement');
  const [holidayOverwriteDialogOpen, setHolidayOverwriteDialogOpen] = useState(false);
  const lastSuccessfulHolidaySyncAt = formatUpdatedAt(settings?.lastSuccessfulHolidaySyncAt);
  const persistedHolidayStateCode = settings?.holidayStateCode ?? '';
  const holidayStateDirty = form.holidayStateCode !== persistedHolidayStateCode;
  const shouldWarnAboutHolidayOverwrite =
    holidayStateDirty && Boolean(settings?.lastSuccessfulHolidaySyncAt);
  const confirmHolidayOverwrite = () => {
    setHolidayOverwriteDialogOpen(false);
    onSubmit();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (shouldWarnAboutHolidayOverwrite) {
      setHolidayOverwriteDialogOpen(true);
      return;
    }
    onSubmit();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <WasteTechnicalConfigurationSection form={form} onChange={onChange} />
      <WasteSettingsCustomRecurrenceSection
        items={form.customRecurrencePresets}
        deletedPresetFallbacks={form.deletedPresetFallbacks}
        saving={saving}
        onChange={(customRecurrencePresets, deletedPresetFallbacks) =>
          onChange((current) => ({ ...current, customRecurrencePresets, deletedPresetFallbacks }))
        }
      />
      <div className="space-y-4">
        <WasteHolidayStateSection
          form={form}
          saving={saving}
          lastSuccessfulHolidaySyncAt={lastSuccessfulHolidaySyncAt}
          onChange={onChange}
        />
        <WasteCalendarWebUrlSection form={form} saving={saving} onChange={onChange} />
        <WasteDisruptionNotificationsSection form={form} saving={saving} onChange={onChange} />
        <WasteInterfaceSelectionSection
          form={form}
          settings={settings}
          saving={saving}
          onChange={onChange}
        />
      </div>
      <div>
        <StudioSaveButton
          type="submit"
          status={saveStatus}
          labels={{
            idle: pt('settings.actions.save'),
            saving: pt('settings.actions.saving'),
            saved: pt('settings.actions.saved'),
          }}
        />
      </div>
      <StudioConfirmDialog
        open={holidayOverwriteDialogOpen}
        title={pt('settings.messages.holidayStateOverwriteWarningTitle')}
        description={pt('settings.messages.holidayStateOverwriteWarningDescription')}
        confirmLabel={pt('settings.actions.save')}
        cancelLabel={pt('settings.actions.cancel')}
        onCancel={() => setHolidayOverwriteDialogOpen(false)}
        onConfirm={confirmHolidayOverwrite}
      />
    </form>
  );
};
