import type { FractionFormState } from './waste-management.master-data.forms.js';
import { FractionSection } from './waste-management.master-data-fraction-create.parts.js';
import {
  FractionReminderChannels,
  FractionReminderCountField,
  reminderChannels,
} from './waste-management.master-data-fraction-reminder-section.parts.js';
import { FractionReminderChannelSlots } from './waste-management.master-data-fraction-reminder-section.slots.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioFieldGroup } from '@sva/studio-ui-react';

export const FractionReminderSection = ({
  form,
  onChange,
}: {
  readonly form: FractionFormState;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const remindersEnabled = form.reminderConfig.reminderCount !== 'none';

  return (
    <FractionSection
      title={pt('masterData.fractions.createView.sections.reminders')}
      description={pt('masterData.fractions.createView.sections.remindersHint')}
    >
      <StudioFieldGroup columns={1}>
        <FractionReminderCountField form={form} onChange={onChange} />
      </StudioFieldGroup>

      <FractionReminderChannels
        form={form}
        onChange={onChange}
        remindersEnabled={remindersEnabled}
      />
      <div className="space-y-3">
        {reminderChannels.map((channel) => (
          <FractionReminderChannelSlots
            key={channel}
            channel={channel}
            form={form}
            onChange={onChange}
          />
        ))}
      </div>
    </FractionSection>
  );
};
