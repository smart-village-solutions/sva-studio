import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';
import { usePluginTranslation, wasteManagementMasterDataContract } from '@sva/plugin-sdk';
import { Button, Input, Select, StudioConfirmDialog, StudioField } from '@sva/studio-ui-react';
import { useState, type ReactNode } from 'react';

import { formatUpdatedAt } from './waste-management.page.support.js';
import { WasteSettingsCustomRecurrenceSection } from './waste-management.settings-custom-recurrence-section.js';
import type {
  CustomRecurrencePresetInputState,
  DeletedPresetFallbackState,
  SettingsFormState,
} from './waste-management.settings.shared.js';
export type {
  CustomRecurrencePresetInputState,
  DeletedPresetFallbackState,
  SettingsFormState,
} from './waste-management.settings.shared.js';

const WasteSettingsSection = ({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) => (
  <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {children}
  </section>
);

const interfaceOptionLabel = (option: NonNullable<WasteManagementSettingsRecord['availableInterfaces']>[number]) =>
  `${option.name} (${option.typeKey})`;

const createVisuallyHiddenLabel = (label: string) => <span className="sr-only">{label}</span>;

export const WasteSettingsForm = ({
  form,
  settings,
  savingSection,
  onChange,
  onSaveInterfaceSelection,
  onSaveHolidayState,
  onSaveCalendarWebUrl,
  onPersistCustomRecurrences,
}: {
  readonly form: SettingsFormState;
  readonly settings: WasteManagementSettingsRecord | null;
  readonly savingSection: 'interface' | 'holiday' | 'calendarWebUrl' | 'customRecurrences' | null;
  readonly onChange: (next: SettingsFormState | ((current: SettingsFormState) => SettingsFormState)) => void;
  readonly onSaveInterfaceSelection: () => void;
  readonly onSaveHolidayState: () => void;
  readonly onSaveCalendarWebUrl: () => void;
  readonly onPersistCustomRecurrences: (
    customRecurrencePresets: readonly CustomRecurrencePresetInputState[],
    deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>
  ) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [holidayOverwriteDialogOpen, setHolidayOverwriteDialogOpen] = useState(false);
  const availableInterfaces = settings?.availableInterfaces ?? [];
  const lastSuccessfulHolidaySyncAt = formatUpdatedAt(settings?.lastSuccessfulHolidaySyncAt);
  const persistedHolidayStateCode = settings?.holidayStateCode ?? '';
  const holidayStateDirty = form.holidayStateCode !== persistedHolidayStateCode;
  const shouldWarnAboutHolidayOverwrite = holidayStateDirty && Boolean(settings?.lastSuccessfulHolidaySyncAt);

  const handleSaveHolidayState = () => {
    if (!form.holidayStateCode || !holidayStateDirty || savingSection === 'holiday') {
      return;
    }
    if (shouldWarnAboutHolidayOverwrite) {
      setHolidayOverwriteDialogOpen(true);
      return;
    }
    onSaveHolidayState();
  };

  return (
    <div className="space-y-4">
      <WasteSettingsCustomRecurrenceSection
        items={form.customRecurrencePresets}
        deletedPresetFallbacks={form.deletedPresetFallbacks}
        saving={savingSection === 'customRecurrences'}
        onPersist={onPersistCustomRecurrences}
      />

      <div className="space-y-4">
        <WasteSettingsSection
          title={pt('settings.messages.holidayStateTitle')}
          description={pt('settings.messages.holidayStateDescription')}
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <StudioField
              id="waste-settings-holiday-state-code"
              label={createVisuallyHiddenLabel(pt('settings.fields.holidayStateCode'))}
            >
              <Select
                id="waste-settings-holiday-state-code"
                value={form.holidayStateCode}
                disabled={savingSection === 'holiday'}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  onChange((current) => ({ ...current, holidayStateCode: nextValue }));
                }}
              >
                <option value="">{pt('settings.fields.holidayStateCodePlaceholder')}</option>
                {wasteManagementMasterDataContract.holidayStateCodes.map((stateCode) => (
                  <option key={stateCode} value={stateCode}>
                    {stateCode}
                  </option>
                ))}
              </Select>
            </StudioField>
            <Button
              type="button"
              disabled={!form.holidayStateCode || !holidayStateDirty || savingSection === 'holiday'}
              onClick={handleSaveHolidayState}
            >
              {savingSection === 'holiday' ? pt('settings.actions.saving') : pt('settings.actions.save')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {pt('settings.meta.lastSuccessfulHolidaySyncAtLabel')}: {lastSuccessfulHolidaySyncAt}
          </p>
        </WasteSettingsSection>

        <WasteSettingsSection
          title={pt('settings.messages.calendarWebUrlTitle')}
          description={pt('settings.messages.calendarWebUrlDescription')}
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <StudioField
              id="waste-settings-calendar-web-url"
              label={createVisuallyHiddenLabel(pt('settings.fields.calendarWebUrl'))}
            >
              <Input
                id="waste-settings-calendar-web-url"
                type="url"
                value={form.calendarWebUrl}
                onChange={(event) => onChange((current) => ({ ...current, calendarWebUrl: event.target.value }))}
                placeholder="https://abfall.example.de"
              />
            </StudioField>
            <Button
              type="button"
              disabled={savingSection === 'calendarWebUrl'}
              onClick={onSaveCalendarWebUrl}
            >
              {savingSection === 'calendarWebUrl' ? pt('settings.actions.saving') : pt('settings.actions.save')}
            </Button>
          </div>
        </WasteSettingsSection>

        <WasteSettingsSection
          title={pt('settings.messages.interfaceSelectionTitle')}
          description={pt('settings.messages.interfaceSelectionDescription')}
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <StudioField
              id="waste-settings-selected-interface-id"
              label={createVisuallyHiddenLabel(pt('settings.fields.selectedInterface'))}
            >
              <Select
                id="waste-settings-selected-interface-id"
                value={form.selectedInterfaceId}
                disabled={availableInterfaces.length === 0 || savingSection === 'interface'}
                onChange={(event) => onChange((current) => ({ ...current, selectedInterfaceId: event.currentTarget.value }))}
              >
                <option value="">{pt('settings.fields.selectedInterfacePlaceholder')}</option>
                {availableInterfaces.map((option) => (
                  <option key={option.id} value={option.id}>
                    {interfaceOptionLabel(option)}
                  </option>
                ))}
              </Select>
            </StudioField>
            <Button
              type="button"
              disabled={!form.selectedInterfaceId || savingSection === 'interface'}
              onClick={onSaveInterfaceSelection}
            >
              {savingSection === 'interface' ? pt('settings.actions.saving') : pt('settings.actions.save')}
            </Button>
          </div>
          {availableInterfaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">{pt('settings.messages.noInterfacesAvailable')}</p>
          ) : null}
        </WasteSettingsSection>
      </div>

      <StudioConfirmDialog
        open={holidayOverwriteDialogOpen}
        title={pt('settings.messages.holidayStateOverwriteWarningTitle')}
        description={pt('settings.messages.holidayStateOverwriteWarningDescription')}
        confirmLabel={pt('settings.actions.save')}
        cancelLabel={pt('settings.actions.cancel')}
        onCancel={() => setHolidayOverwriteDialogOpen(false)}
        onConfirm={() => {
          setHolidayOverwriteDialogOpen(false);
          onSaveHolidayState();
        }}
      />
    </div>
  );
};
