import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';
import { usePluginTranslation, wasteManagementMasterDataContract } from '@sva/plugin-sdk';
import { Input, Select, StudioField } from '@sva/studio-ui-react';
import type { ReactNode } from 'react';

import { WasteSettingsTechnicalConfigFields } from './waste-management.settings-managed-fields.js';
import type { SettingsFormState } from './waste-management.settings.shared.js';

type WasteSettingsSectionProps = {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
};

const WasteSettingsSection = ({ title, description, children }: Readonly<WasteSettingsSectionProps>) => (
  <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {children}
  </section>
);

const createVisuallyHiddenLabel = (label: string) => <span className="sr-only">{label}</span>;

const interfaceOptionLabel = (option: NonNullable<WasteManagementSettingsRecord['availableInterfaces']>[number]) =>
  `${option.name} (${option.typeKey})`;

type WasteSettingsFieldUpdater = (
  next: SettingsFormState | ((current: SettingsFormState) => SettingsFormState)
) => void;

type SharedSectionProps = {
  readonly form: SettingsFormState;
  readonly saving: boolean;
  readonly onChange: WasteSettingsFieldUpdater;
};

export const WasteTechnicalConfigurationSection = ({
  form,
  onChange,
}: {
  readonly form: SettingsFormState;
  readonly onChange: WasteSettingsFieldUpdater;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <WasteSettingsSection
      title={pt('settings.technical.title')}
      description={pt('settings.technical.description')}
    >
      <WasteSettingsTechnicalConfigFields form={form} pt={pt} onChange={onChange} />
    </WasteSettingsSection>
  );
};

export const WasteHolidayStateSection = ({
  form,
  lastSuccessfulHolidaySyncAt,
  saving,
  onChange,
}: SharedSectionProps & {
  readonly lastSuccessfulHolidaySyncAt: string;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <WasteSettingsSection
      title={pt('settings.messages.holidayStateTitle')}
      description={pt('settings.messages.holidayStateDescription')}
    >
      <div className="grid gap-3">
        <StudioField
          id="waste-settings-holiday-state-code"
          label={createVisuallyHiddenLabel(pt('settings.fields.holidayStateCode'))}
        >
          <Select
            id="waste-settings-holiday-state-code"
            value={form.holidayStateCode}
            disabled={saving}
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
      </div>
      <p className="text-sm text-muted-foreground">
        {pt('settings.meta.lastSuccessfulHolidaySyncAtLabel')}: {lastSuccessfulHolidaySyncAt}
      </p>
    </WasteSettingsSection>
  );
};

export const WasteCalendarWebUrlSection = ({
  form,
  saving,
  onChange,
}: SharedSectionProps) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <WasteSettingsSection
      title={pt('settings.messages.calendarWebUrlTitle')}
      description={pt('settings.messages.calendarWebUrlDescription')}
    >
      <div className="grid gap-3">
        <StudioField
          id="waste-settings-calendar-web-url"
          label={createVisuallyHiddenLabel(pt('settings.fields.calendarWebUrl'))}
        >
          <Input
            id="waste-settings-calendar-web-url"
            type="url"
            value={form.calendarWebUrl}
            disabled={saving}
            onChange={(event) => onChange((current) => ({ ...current, calendarWebUrl: event.target.value }))}
            placeholder="https://abfall.example.de"
          />
        </StudioField>
      </div>
    </WasteSettingsSection>
  );
};

export const WasteInterfaceSelectionSection = ({
  form,
  settings,
  saving,
  onChange,
}: SharedSectionProps & {
  readonly settings: WasteManagementSettingsRecord | null;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const availableInterfaces = settings?.availableInterfaces ?? [];

  return (
    <WasteSettingsSection
      title={pt('settings.messages.interfaceSelectionTitle')}
      description={pt('settings.messages.interfaceSelectionDescription')}
    >
      <div className="grid gap-3">
        <StudioField
          id="waste-settings-selected-interface-id"
          label={createVisuallyHiddenLabel(pt('settings.fields.selectedInterface'))}
        >
          <Select
            id="waste-settings-selected-interface-id"
            value={form.selectedInterfaceId}
            disabled={availableInterfaces.length === 0 || saving}
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
      </div>
      {availableInterfaces.length === 0 ? (
        <p className="text-sm text-muted-foreground">{pt('settings.messages.noInterfacesAvailable')}</p>
      ) : null}
    </WasteSettingsSection>
  );
};
